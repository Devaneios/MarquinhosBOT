import {
  DOMINOES_BOT_USER_ID,
  DominoesBot,
} from 'services/activity/dominoesBlock/DominoesBot';
import {
  DominoesEngine,
  type ChainEnd,
  type DominoesState,
  type Tile,
} from 'services/activity/dominoesBlock/DominoesEngine';
import { DisconnectGraceTimer } from 'services/activity/shared/DisconnectGraceTimer';
import { GamificationService } from 'services/gamification';
import { logger } from 'utils/logger';

// Per-player addressing, same rationale as cards' PerClientBroadcaster: each
// player's view hides everyone else's hand, so a single public broadcast
// would leak opponents' tiles.
export interface DominoesBroadcaster {
  sendToPlayer(
    userId: string,
    message: { type: string; payload?: unknown },
  ): void;
  broadcastPublic(message: { type: string; payload?: unknown }): void;
}

export interface GamificationLike {
  recordGameResult(input: {
    sessionId: string;
    guildId: string;
    gameType: string;
    results: { userId: string; position: number }[];
  }): void;
}

export interface DominoesSessionIdentity {
  sessionKey: string;
  instanceId: string;
  guildId: string;
}

export interface DominoesSessionOptions {
  onSessionEnded?: () => void;
  disconnectGraceMs?: number;
  minPlayers?: number;
  maxPlayers?: number;
  rng?: () => number;
  botMoveDelayMs?: number;
}

const DEFAULT_BOT_MOVE_DELAY_MS = 700;

interface DominoesPlayer {
  userId: string;
  connected: boolean;
  connections: Set<unknown>;
}

const DEFAULT_DISCONNECT_GRACE_MS = 30_000;
const DEFAULT_MIN_PLAYERS = 2;
const DEFAULT_MAX_PLAYERS = 4;

// The publicly visible shape of a state broadcast: everyone's hand is
// reduced to a count except the recipient's own, which is left intact.
export interface DominoesClientState {
  players: string[];
  handCounts: Record<string, number>;
  hand: Tile[] | null;
  boneyard: number;
  chain: Tile[];
  leftEnd: number | null;
  rightEnd: number | null;
  currentPlayer: string | null;
  winner: string | null;
  winners: string[] | null;
  blocked: boolean;
  pipTotals: Record<string, number> | null;
}

function maskState(
  state: DominoesState,
  forPlayer: string | null,
): DominoesClientState {
  const handCounts: Record<string, number> = {};
  for (const player of state.players) {
    handCounts[player] = state.hands[player]?.length ?? 0;
  }
  return {
    players: state.players,
    handCounts,
    hand: forPlayer ? (state.hands[forPlayer] ?? null) : null,
    boneyard: state.boneyard.length,
    chain: state.chain,
    leftEnd: state.leftEnd,
    rightEnd: state.rightEnd,
    currentPlayer: state.currentPlayer,
    winner: state.winner,
    winners: state.winners,
    blocked: state.blocked,
    pipTotals: state.pipTotals,
  };
}

// Orchestration layer around DominoesEngine: seating, reconnect grace, move
// dispatch, gamification. Structurally parallel to CardTableSession (masked
// per-player state, event-driven rather than ticked) but without a
// pluggable ruleset, since this game only ever plays block dominoes.
export class DominoesSession {
  private players: DominoesPlayer[] = [];
  private spectators = new Map<string, Set<unknown>>();
  private engine: DominoesEngine | null = null;
  private resultRecorded = false;
  private restartVotes = new Set<string>();
  private disconnectGrace = new DisconnectGraceTimer<string>();
  private readonly onSessionEnded?: () => void;
  private readonly disconnectGraceMs: number;
  private readonly minPlayers: number;
  private readonly maxPlayers: number;
  private botUserId: string | null = null;
  private bot: DominoesBot | null = null;
  private readonly botMoveDelayMs: number;
  private botTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private identity: DominoesSessionIdentity,
    private broadcaster: DominoesBroadcaster,
    private gamification: GamificationLike = new GamificationService(),
    private options: DominoesSessionOptions = {},
  ) {
    this.onSessionEnded = options.onSessionEnded;
    this.disconnectGraceMs =
      options.disconnectGraceMs ?? DEFAULT_DISCONNECT_GRACE_MS;
    this.minPlayers = options.minPlayers ?? DEFAULT_MIN_PLAYERS;
    this.maxPlayers = options.maxPlayers ?? DEFAULT_MAX_PLAYERS;
    this.botMoveDelayMs = options.botMoveDelayMs ?? DEFAULT_BOT_MOVE_DELAY_MS;
  }

  // Seats the bot as a genuine dealt-in player (block dominoes has no
  // "virtual side" the way a masked 2-side board game does — the engine
  // deals real tiles into a real seat), then starts the match once that
  // brings the table up to `minPlayers`.
  enableBot(): void {
    if (this.botUserId) return;
    this.botUserId = DOMINOES_BOT_USER_ID;
    this.bot = new DominoesBot();
    this.players.push({
      userId: this.botUserId,
      connected: true,
      connections: new Set(),
    });
    if (this.players.length >= this.minPlayers) this.start();
  }

  private clearBotTimer(): void {
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }
  }

  private maybeScheduleBotMove(): void {
    if (!this.bot || !this.botUserId || !this.engine) return;
    if (this.engine.isOver()) return;
    if (this.engine.getState().currentPlayer !== this.botUserId) return;
    if (this.botTimer) return;

    this.botTimer = setTimeout(() => {
      this.botTimer = null;
      this.playBotMove();
    }, this.botMoveDelayMs);
  }

  private playBotMove(): void {
    if (!this.bot || !this.botUserId || !this.engine) return;
    if (
      this.engine.isOver() ||
      this.engine.getState().currentPlayer !== this.botUserId
    ) {
      return;
    }

    const move = this.bot.chooseMove(this.engine, this.botUserId);
    const result = move
      ? this.engine.playTile(this.botUserId, move.tile, move.end)
      : this.engine.pass(this.botUserId);

    if (!result.success) return;
    this.afterStateChange();
  }

  get playerCount(): number {
    return this.players.length;
  }

  addPlayer(userId: string, connection: unknown): boolean {
    const existing = this.players.find((p) => p.userId === userId);
    if (existing) {
      existing.connections.add(connection);
      if (!existing.connected) this.resumeExisting(existing);
      else this.sendStateTo(userId);
      return true;
    }

    // A live match's seats belong to the players it was dealt to; a
    // newcomer joining mid-match becomes a spectator instead of an
    // impossible fifth hand.
    if (this.engine || this.players.length >= this.maxPlayers) {
      this.addSpectator(userId, connection);
      return false;
    }

    this.players.push({
      userId,
      connected: true,
      connections: new Set([connection]),
    });
    this.spectators.delete(userId);

    if (this.players.length >= this.minPlayers) {
      this.start();
    }
    return true;
  }

  private addSpectator(userId: string, connection: unknown): void {
    const existing = this.spectators.get(userId);
    if (existing) existing.add(connection);
    else this.spectators.set(userId, new Set([connection]));
    this.sendStateTo(userId);
  }

  private resumeExisting(player: DominoesPlayer): void {
    player.connected = true;
    this.disconnectGrace.disarm(player.userId);
    this.broadcaster.broadcastPublic({
      type: 'opponent_reconnected',
      payload: { userId: player.userId },
    });
    this.broadcastState();
  }

  private releaseConnection(
    player: DominoesPlayer,
    connection: unknown,
  ): boolean {
    player.connections.delete(connection);
    return player.connections.size === 0;
  }

  start(): void {
    this.engine = new DominoesEngine(
      this.players.map((p) => p.userId),
      { rng: this.options.rng },
    );
    this.resultRecorded = false;
    logger.info('dominoesBlock.match_started', {
      sessionKey: this.identity.sessionKey,
      players: this.players.length,
    });
    this.broadcastState();
    this.maybeScheduleBotMove();
  }

  playTile(userId: string, tile: Tile, end?: ChainEnd): void {
    if (!this.engine) return;
    if (!this.players.some((p) => p.userId === userId)) {
      this.reject(userId, 'You are not seated at this table');
      return;
    }
    const result = this.engine.playTile(userId, tile, end);
    if (!result.success) {
      this.reject(userId, result.error ?? 'Invalid move');
      return;
    }
    this.afterStateChange();
  }

  passTurn(userId: string): void {
    if (!this.engine) return;
    if (!this.players.some((p) => p.userId === userId)) {
      this.reject(userId, 'You are not seated at this table');
      return;
    }
    const result = this.engine.pass(userId);
    if (!result.success) {
      this.reject(userId, result.error ?? 'Invalid move');
      return;
    }
    this.afterStateChange();
  }

  private afterStateChange(): void {
    if (!this.engine) return;
    this.broadcastState();
    if (this.engine.isOver() && !this.resultRecorded) {
      this.resultRecorded = true;
      this.recordResult();
      this.broadcaster.broadcastPublic({
        type: 'match_over',
        payload: {
          winner: this.engine.getState().winner,
          winners: this.engine.getState().winners,
          blocked: this.engine.getState().blocked,
        },
      });
      return;
    }
    this.maybeScheduleBotMove();
  }

  requestRestart(userId: string): void {
    if (!this.engine || !this.engine.isOver()) return;
    if (!this.players.some((p) => p.userId === userId)) return;

    this.restartVotes.add(userId);
    // The bot always "votes" — it can't click a restart button, and the
    // human is the only one whose consent should gate a rematch.
    const required = this.players.filter(
      (p) => p.connected && p.userId !== this.botUserId,
    ).length;
    if (this.restartVotes.size < required) {
      this.broadcaster.broadcastPublic({
        type: 'restart_status',
        payload: { votes: this.restartVotes.size, required },
      });
      return;
    }

    this.restartVotes.clear();
    this.start();
  }

  private reject(userId: string, reason: string): void {
    this.broadcaster.sendToPlayer(userId, {
      type: 'move_rejected',
      payload: { reason },
    });
  }

  private broadcastState(): void {
    for (const player of this.players) {
      if (!player.connected) continue;
      if (player.userId === this.botUserId) continue;
      this.sendStateTo(player.userId);
    }
    for (const userId of this.spectators.keys()) this.sendStateTo(userId);
  }

  private sendStateTo(userId: string): void {
    if (!this.engine) return;
    const isPlayer = this.players.some((p) => p.userId === userId);
    this.broadcaster.sendToPlayer(userId, {
      type: 'state',
      payload: maskState(this.engine.getState(), isPlayer ? userId : null),
    });
  }

  private recordResult(): void {
    if (!this.engine) return;
    // Bot matches have only one real outcome to track and no opponent to
    // rank against — matches the fleet-wide convention of skipping
    // gamification recording in solo/bot mode.
    if (this.botUserId) return;
    const state = this.engine.getState();
    const winners = new Set(state.winners ?? []);
    this.gamification.recordGameResult({
      sessionId: this.identity.instanceId,
      guildId: this.identity.guildId,
      gameType: 'dominoes-block',
      results: this.players.map((player) => ({
        userId: player.userId,
        position: winners.has(player.userId) ? 1 : 2,
      })),
    });
  }

  // Real network drop: holds the seat open for disconnectGraceMs so a
  // reconnect can resume the same match, then forfeits (removes the seat,
  // leaving the rest to keep playing) if the grace lapses. Unlike Pong there
  // is no loop to freeze — the table simply waits on that player's turn.
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

    if (!this.engine || this.engine.isOver()) {
      this.detach(userId);
      return;
    }

    player.connected = false;
    this.broadcaster.broadcastPublic({
      type: 'opponent_disconnected',
      payload: { userId, timeoutMs: this.disconnectGraceMs },
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
    this.removePlayer(userId);
  }

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
    // A match already in progress can't reshuffle a live hand back into the
    // deck once a seat is gone, so a walkout just ends the table rather than
    // pretending the remaining players can keep playing a game that was
    // dealt for one more player than are left.
    if (this.engine && !this.engine.isOver()) {
      this.engine = null;
      this.broadcaster.broadcastPublic({
        type: 'match_over',
        payload: {
          winner: null,
          winners: null,
          blocked: false,
          abandoned: true,
        },
      });
    }
    this.endIfEmpty();
  }

  private endIfEmpty(): void {
    // The bot's own seat never leaves via pauseForDisconnect/leave (it has
    // no real connection), so once every *real* player is gone the table
    // is just as empty as if `players` were literally [].
    const realPlayers = this.players.filter((p) => p.userId !== this.botUserId);
    if (realPlayers.length === 0 && this.spectators.size === 0) {
      this.disconnectGrace.clear();
      this.clearBotTimer();
      this.onSessionEnded?.();
    }
  }

  // MANDATORY per §6.2: clears disconnect grace so it can't outlive a
  // disposed room.
  dispose(): void {
    this.clearBotTimer();
    this.disconnectGrace.clear();
  }
}
