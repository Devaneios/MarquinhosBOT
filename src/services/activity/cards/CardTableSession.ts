import type { GameDefinition } from 'services/activity/cards/core/GameDefinition';
import { SeededRng } from 'services/activity/cards/core/rng';
import type { PerClientBroadcaster } from 'services/activity/cards/PerClientBroadcaster';
import { DisconnectGraceTimer } from 'services/activity/shared/DisconnectGraceTimer';
import { logger } from 'utils/logger';

export interface CardTableIdentity {
  sessionKey: string;
  instanceId: string;
  guildId: string;
}

export interface GamificationLike {
  recordGameResult(input: {
    sessionId: string;
    guildId: string;
    gameType: string;
    results: { userId: string; position: number }[];
  }): void;
}

export interface CardTableSessionOptions {
  onSessionEnded?: () => void;
  disconnectGraceMs?: number;
  setupOptions?: unknown;
  // Fixes the deal for tests and for replaying a recorded match. Omitted in
  // production, where the engine issues a fresh seed per match.
  seed?: number;
}

interface CardTablePlayer {
  userId: string;
  seatIndex: number;
  connected: boolean;
  connections: Set<unknown>;
}

const DEFAULT_DISCONNECT_GRACE_MS = 30_000;

// Orchestration layer for a card table: seats, reconnect grace, the turn clock,
// move dispatch into the pluggable GameDefinition, and gamification recording.
// Structurally parallel to PongSession, but event-driven (a move arrives, gets
// validated + applied, state broadcasts) instead of ticked — card games have no
// continuous physics to simulate.
export class CardTableSession<TState> {
  private players: CardTablePlayer[] = [];
  // Watchers with no seat: someone who opened the Activity after the match
  // started, or a player whose seat was freed. They receive the spectator view
  // and nothing else.
  private spectators = new Map<string, Set<unknown>>();
  private state: TState | null = null;
  private resultRecorded = false;
  private restartVotes = new Set<string>();
  private disconnectGrace = new DisconnectGraceTimer<string>();
  private turnClock = new DisconnectGraceTimer<string>();
  private roundAnnounced = false;
  private seed: number;
  private readonly onSessionEnded?: () => void;
  private readonly disconnectGraceMs: number;

  constructor(
    private identity: CardTableIdentity,
    private broadcaster: PerClientBroadcaster,
    private definition: GameDefinition<TState>,
    private gamification: GamificationLike,
    private options: CardTableSessionOptions = {},
  ) {
    this.onSessionEnded = options.onSessionEnded;
    this.disconnectGraceMs =
      options.disconnectGraceMs ?? DEFAULT_DISCONNECT_GRACE_MS;
    this.seed = options.seed ?? SeededRng.randomSeed();
  }

  get playerCount(): number {
    return this.players.length;
  }

  get spectatorCount(): number {
    return this.spectators.size;
  }

  // ─── Seating ──────────────────────────────────────────────────────────────

  // The single seat allocator. Seat identity is derived from *occupancy*, never
  // from `players.length`: seats are freed out of order, so a count-based index
  // hands a joiner a seat someone else is already sitting in (fill 0-3, seat 1
  // leaves, next joiner gets 3 — a collision with a live player).
  private firstFreeSeat(): number | null {
    const taken = new Set(this.players.map((p) => p.seatIndex));
    for (let seat = 0; seat < this.definition.maxPlayers; seat++) {
      if (!taken.has(seat)) return seat;
    }
    return null;
  }

  // Predicts where a join will land without mutating anything, so the Room can
  // send a seat assignment before addPlayer's own (possibly game-starting)
  // broadcast. Shares firstFreeSeat() with addPlayer so the prediction cannot
  // drift from the assignment. null means "no seat" — a spectator.
  seatIndexFor(userId: string): number | null {
    const existing = this.players.find((p) => p.userId === userId);
    if (existing) return existing.seatIndex;
    // A live match's seats belong to the players named in its state; handing a
    // free seat to a newcomer mid-match would give them a seat the ruleset has
    // never heard of, and no legal moves ever.
    if (this.state && !this.definition.isMatchOver(this.state)) return null;
    return this.firstFreeSeat();
  }

  addPlayer(userId: string, connection: unknown): number | null {
    const existing = this.players.find((p) => p.userId === userId);
    if (existing) {
      existing.connections.add(connection);
      if (!existing.connected) this.resumeExisting(existing);
      else this.sendStateTo(userId);
      return existing.seatIndex;
    }

    const seatIndex = this.seatIndexFor(userId);
    if (seatIndex === null) {
      this.addSpectator(userId, connection);
      return null;
    }

    this.players.push({
      userId,
      seatIndex,
      connected: true,
      connections: new Set([connection]),
    });
    this.spectators.delete(userId);

    if (this.players.length >= this.definition.minPlayers && !this.state) {
      this.start();
    } else if (this.state) {
      this.broadcastMaskedState();
    }
    return seatIndex;
  }

  private addSpectator(userId: string, connection: unknown): void {
    const existing = this.spectators.get(userId);
    if (existing) existing.add(connection);
    else this.spectators.set(userId, new Set([connection]));
    this.sendStateTo(userId);
  }

  private resumeExisting(player: CardTablePlayer): void {
    player.connected = true;
    this.disconnectGrace.disarm(player.userId);
    this.broadcaster.broadcastPublic({
      type: 'opponent_reconnected',
      payload: { userId: player.userId, seatIndex: player.seatIndex },
    });
    this.broadcastMaskedState();
  }

  private releaseConnection(
    player: CardTablePlayer,
    connection: unknown,
  ): boolean {
    player.connections.delete(connection);
    return player.connections.size === 0;
  }

  // ─── Match lifecycle ──────────────────────────────────────────────────────

  start(): void {
    this.state = this.definition.setup({
      players: this.players.map((p) => ({
        userId: p.userId,
        seatIndex: p.seatIndex,
      })),
      options: this.options.setupOptions,
      seed: this.seed,
    });
    this.resultRecorded = false;
    this.roundAnnounced = false;
    logger.info('cards.match_started', {
      sessionKey: this.identity.sessionKey,
      gameType: this.definition.id,
      // Recorded so a reported deal can be reproduced from the log alone.
      seed: this.seed,
      players: this.players.length,
    });
    this.broadcastMaskedState();
    this.armTurnClock();
  }

  handleMove(userId: string, move: string, rawArgs: unknown): void {
    if (!this.state) return;

    // Terminal-state gate. `isMatchOver` is the engine's business, not
    // something every ruleset must remember to re-check in every one of its
    // move handlers — miss it in one and a finished match keeps accepting moves
    // and rewriting its own final score.
    if (this.definition.isMatchOver(this.state)) {
      this.reject(userId, 'A partida já terminou');
      return;
    }

    if (!this.players.some((p) => p.userId === userId)) {
      this.reject(userId, 'Você não está jogando nesta mesa');
      return;
    }

    const moveDef = this.definition.moves[move];
    if (!moveDef) {
      this.reject(userId, 'Unknown move');
      return;
    }

    // Where `unknown` stops: the raw client payload is parsed into the move's
    // own arg type before any rule logic sees it.
    let args: unknown;
    if (moveDef.parseArgs) {
      const parsed = moveDef.parseArgs(rawArgs);
      if (parsed === null) {
        this.reject(userId, 'Argumentos inválidos para esta jogada');
        return;
      }
      args = parsed;
    }

    const result = moveDef.validate(this.state, userId, args);
    if (!result.ok) {
      this.reject(userId, result.reason);
      return;
    }

    this.state = moveDef.apply(this.state, userId, args);
    this.afterStateChange();
  }

  // The one place that reacts to a new state, so the match-over/round-over
  // bookkeeping cannot be half-applied by whichever path produced it.
  private afterStateChange(): void {
    if (!this.state) return;
    this.broadcastMaskedState();
    this.announceRoundIfChanged();

    if (this.definition.isMatchOver(this.state)) {
      this.disarmTurnClock();
      if (!this.resultRecorded) {
        this.resultRecorded = true;
        this.recordResult();
      }
      this.broadcaster.broadcastPublic({
        type: 'match_over',
        payload: { scoreboard: this.definition.scoreboard(this.state) },
      });
      return;
    }
    this.armTurnClock();
  }

  private announceRoundIfChanged(): void {
    if (!this.state) return;
    const roundOver = this.definition.isRoundOver(this.state);
    if (roundOver && !this.roundAnnounced) {
      this.roundAnnounced = true;
      this.broadcaster.broadcastPublic({ type: 'round_over' });
    } else if (!roundOver) {
      this.roundAnnounced = false;
    }
  }

  requestRestart(userId: string): void {
    if (!this.state || !this.definition.isMatchOver(this.state)) return;
    if (!this.players.some((p) => p.userId === userId)) return;

    this.restartVotes.add(userId);
    // Only connected players can vote, so one player who closed their tab
    // during the results screen can't block everyone else's rematch.
    const required = this.players.filter((p) => p.connected).length;
    if (this.restartVotes.size < required) {
      this.broadcaster.broadcastPublic({
        type: 'restart_status',
        payload: { votes: this.restartVotes.size, required },
      });
      return;
    }

    this.restartVotes.clear();
    // A rematch is a new deal, so it gets a new seed.
    this.seed = SeededRng.randomSeed();
    this.start();
  }

  // ─── The turn clock ───────────────────────────────────────────────────────

  // A player who simply stops acting stalls the table forever — the disconnect
  // grace only covers sockets that actually drop. Armed only when the ruleset
  // supplies all three pieces, because the engine cannot see whose turn it is
  // inside an opaque TState.
  private armTurnClock(): void {
    this.disarmTurnClock();
    const definition = this.definition;
    if (
      !definition.turnTimeoutMs ||
      !definition.playersToAct ||
      !definition.onTurnTimeout ||
      !this.state
    ) {
      return;
    }

    // Called through `definition` rather than destructured: a definition is a
    // plain object literal, so pulling its methods off first would silently
    // strip the receiver any `this`-using ruleset depends on.
    for (const userId of definition.playersToAct(this.state)) {
      this.turnClock.arm(userId, definition.turnTimeoutMs, () =>
        this.handleTurnTimeout(userId),
      );
    }
  }

  // Clears every armed turn timer, not just the current players' — a seat freed
  // mid-turn would otherwise leave a timer pointing at a player who has gone.
  private disarmTurnClock(): void {
    this.turnClock.clear();
  }

  private handleTurnTimeout(userId: string): void {
    if (!this.state || !this.definition.onTurnTimeout) return;
    if (this.definition.isMatchOver(this.state)) return;
    logger.info('cards.turn_timeout', {
      sessionKey: this.identity.sessionKey,
      gameType: this.definition.id,
      userId,
    });
    this.state = this.definition.onTurnTimeout(this.state, userId);
    this.broadcaster.broadcastPublic({
      type: 'turn_timeout',
      payload: { userId },
    });
    this.afterStateChange();
  }

  // ─── Broadcasting ─────────────────────────────────────────────────────────

  private reject(userId: string, reason: string): void {
    this.broadcaster.sendToPlayer(userId, {
      type: 'move_rejected',
      payload: { reason },
    });
  }

  private broadcastMaskedState(): void {
    if (!this.state) return;
    for (const player of this.players) {
      if (!player.connected) continue;
      this.sendStateTo(player.userId);
    }
    for (const userId of this.spectators.keys()) this.sendStateTo(userId);
  }

  private sendStateTo(userId: string): void {
    if (!this.state) return;
    const isPlayer = this.players.some((p) => p.userId === userId);
    this.broadcaster.sendToPlayer(userId, {
      type: 'state',
      // A spectator is masked as `null`, which is the same code path a player
      // uses for everyone else's cards — there is no separate spectator
      // rendering that could forget to hide something.
      payload: this.definition.maskStateFor(
        this.state,
        isPlayer ? userId : null,
      ),
    });
  }

  private recordResult(): void {
    if (!this.state) return;
    this.gamification.recordGameResult({
      sessionId: this.identity.instanceId,
      guildId: this.identity.guildId,
      gameType: this.definition.id,
      results: this.definition.scoreboard(this.state),
    });
  }

  // ─── Leaving ──────────────────────────────────────────────────────────────

  // Real network drop (no explicit `leave` first): freezes nothing (there is no
  // tick loop to freeze) but holds the seat open for disconnectGraceMs so a
  // reconnect can resume the same match, then forfeits if the grace lapses.
  pauseForDisconnect(userId: string, connection: unknown): void {
    const spectator = this.spectators.get(userId);
    if (spectator) {
      spectator.delete(connection);
      if (spectator.size === 0) this.spectators.delete(userId);
      this.endIfEmpty();
      return;
    }

    const player = this.players.find((p) => p.userId === userId);
    if (!player) return;
    if (!this.releaseConnection(player, connection)) return;
    if (!player.connected) return;

    if (!this.state || this.definition.isMatchOver(this.state)) {
      this.detach(userId);
      return;
    }

    player.connected = false;
    this.turnClock.disarm(userId);
    this.broadcaster.broadcastPublic({
      type: 'opponent_disconnected',
      payload: {
        userId,
        seatIndex: player.seatIndex,
        timeoutMs: this.disconnectGraceMs,
      },
    });
    this.disconnectGrace.arm(userId, this.disconnectGraceMs, () =>
      this.forfeitDisconnected(userId),
    );
  }

  private forfeitDisconnected(userId: string): void {
    const player = this.players.find((p) => p.userId === userId);
    if (!player || player.connected) return;
    this.detach(userId);
  }

  private detach(userId: string): void {
    this.disconnectGrace.disarm(userId);
    this.turnClock.disarm(userId);

    if (this.state && !this.definition.isMatchOver(this.state)) {
      const forfeited = this.definition.onDisconnectForfeit
        ? this.definition.onDisconnectForfeit(this.state, userId)
        : null;
      if (forfeited) {
        this.state = forfeited;
        this.removePlayer(userId);
        this.afterStateChange();
        return;
      }
      // No forfeit handling means the match stays live with an empty seat that
      // still owes a turn — an unplayable table. Loud rather than silent,
      // because the symptom (a room that stops responding) is otherwise very
      // hard to trace back to a missing hook.
      logger.warn('cards.walkout_unhandled', {
        sessionKey: this.identity.sessionKey,
        gameType: this.definition.id,
        userId,
        detail:
          'GameDefinition has no onDisconnectForfeit; the match continues short-handed',
      });
    }
    this.removePlayer(userId);
  }

  // Explicit, deliberate exit: the client sent `{type:'leave'}`. No grace
  // period — the seat is freed immediately.
  leave(userId: string, connection: unknown): void {
    const spectator = this.spectators.get(userId);
    if (spectator) {
      spectator.delete(connection);
      if (spectator.size === 0) this.spectators.delete(userId);
      this.endIfEmpty();
      return;
    }
    const player = this.players.find((p) => p.userId === userId);
    if (!player) return;
    if (!this.releaseConnection(player, connection)) return;
    this.detach(userId);
  }

  private removePlayer(userId: string): void {
    this.players = this.players.filter((p) => p.userId !== userId);
    this.restartVotes.delete(userId);
    this.endIfEmpty();
  }

  private endIfEmpty(): void {
    if (this.players.length === 0 && this.spectators.size === 0) {
      this.disarmTurnClock();
      this.onSessionEnded?.();
    }
  }

  // MANDATORY per §6.2: clears both timer sets so neither outlives a
  // disposed room.
  dispose(): void {
    this.disconnectGrace.clear();
    this.turnClock.clear();
  }
}
