import { BattleshipBot } from 'services/activity/battleship/BattleshipBot';
import {
  BattleshipEngine,
  type BattleshipSide,
  type ShipPlacement,
} from 'services/activity/battleship/BattleshipEngine';
import {
  spectatorViewFor,
  viewFor,
} from 'services/activity/battleship/masking';
import type { PerClientBroadcaster } from 'services/activity/cards/PerClientBroadcaster';
import type { ActivityMode } from 'services/activity/gameId';
import { DisconnectGraceTimer } from 'services/activity/shared/DisconnectGraceTimer';
import { GamificationService } from 'services/gamification';

export interface BattleshipSessionIdentity {
  sessionKey: string;
  instanceId: string;
  guildId: string;
  mode: ActivityMode;
}

export interface BattleshipSessionOptions {
  onSessionEnded?: () => void;
  disconnectGraceMs?: number;
  botMoveDelayMs?: number;
  emptyRoomGraceMs?: number;
}

const DEFAULT_BOT_MOVE_DELAY_MS = 600;
const DEFAULT_EMPTY_ROOM_GRACE_MS = 1500;

interface BattleshipPlayer {
  userId: string;
  side: BattleshipSide;
  connected: boolean;
  connections: Set<unknown>;
}

const DEFAULT_DISCONNECT_GRACE_MS = 30_000;

// Orchestration layer, structurally parallel to PongSession/CardTableSession:
// seats, reconnect grace, gamification recording. Unlike Pong's single public
// broadcast, every state push here is per-player (PerClientBroadcaster),
// because the two masked views (masking.ts's viewFor) are never the same
// payload.
export class BattleshipSession {
  private engine = new BattleshipEngine();
  private players: BattleshipPlayer[] = [];
  // Non-participants (Task 14: spectator broadcast extension). Deliberately
  // not routed through addPlayer/players — this.players.length >= 2 is the
  // "no free seat" rule for a would-be player, not the room-level
  // player/spectator/queued authority MatchRoom's seat already resolved
  // before ever calling into this session.
  private spectators = new Map<string, Set<unknown>>();
  private resultRecorded = false;
  private lastWinnerSide: BattleshipSide | null = null;
  private disconnectGrace = new DisconnectGraceTimer<string>();
  private readonly onSessionEnded?: () => void;
  private readonly disconnectGraceMs: number;
  private botSide: BattleshipSide | null = null;
  private bot: BattleshipBot | null = null;
  private readonly botMoveDelayMs: number;
  private botTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly emptyRoomGraceMs: number;
  private emptyRoomTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private identity: BattleshipSessionIdentity,
    private broadcaster: PerClientBroadcaster,
    private gamification: GamificationService = new GamificationService(),
    options: BattleshipSessionOptions = {},
  ) {
    this.onSessionEnded = options.onSessionEnded;
    this.disconnectGraceMs =
      options.disconnectGraceMs ?? DEFAULT_DISCONNECT_GRACE_MS;
    this.botMoveDelayMs = options.botMoveDelayMs ?? DEFAULT_BOT_MOVE_DELAY_MS;
    this.emptyRoomGraceMs =
      options.emptyRoomGraceMs ?? DEFAULT_EMPTY_ROOM_GRACE_MS;
  }

  private clearEmptyRoomTimer(): void {
    if (this.emptyRoomTimer) {
      clearTimeout(this.emptyRoomTimer);
      this.emptyRoomTimer = null;
    }
  }

  enableBot(humanSide: BattleshipSide): void {
    this.botSide = humanSide === 'p1' ? 'p2' : 'p1';
    this.bot = new BattleshipBot();
    // Bot places immediately — human still places at their own pace, and
    // the engine only advances to 'battle' once both sides are placed.
    this.engine.placeShips(this.botSide, this.bot.generatePlacements());
  }

  private clearBotTimer(): void {
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }
  }

  private maybeScheduleBotShot(): void {
    if (!this.bot || !this.botSide) return;
    if (this.engine.getPhase() !== 'battle') return;
    if (this.engine.getTurn() !== this.botSide) return;
    if (this.botTimer) return;

    this.botTimer = setTimeout(() => {
      this.botTimer = null;
      this.playBotShot();
    }, this.botMoveDelayMs);
  }

  private playBotShot(): void {
    if (!this.bot || !this.botSide) return;
    if (
      this.engine.getPhase() !== 'battle' ||
      this.engine.getTurn() !== this.botSide
    ) {
      return;
    }

    const shot = this.bot.chooseShot();
    if (!shot) return;

    const result = this.engine.fire(this.botSide, shot.x, shot.y);
    if (!result.ok) return;

    this.bot.recordResult(shot, result.hit ?? false, Boolean(result.sunk));
    this.broadcastState();

    if (result.winner && !this.resultRecorded) {
      this.resultRecorded = true;
      this.lastWinnerSide = result.winner;
      this.recordResult(result.winner);
      return;
    }

    this.maybeScheduleBotShot();
  }

  get playerCount(): number {
    return this.players.length;
  }

  addPlayer(userId: string, connection: unknown): BattleshipSide | null {
    this.clearEmptyRoomTimer();
    const existing = this.players.find((p) => p.userId === userId);
    if (existing) {
      existing.connections.add(connection);
      if (!existing.connected) this.resumeExisting(existing);
      else this.sendStateTo(existing.userId, existing.side);
      return existing.side;
    }
    if (this.players.length >= 2) return null;
    const side: BattleshipSide = this.players.length === 0 ? 'p1' : 'p2';
    this.players.push({
      userId,
      side,
      connected: true,
      connections: new Set([connection]),
    });
    if (this.players.length === 2) this.broadcastState();
    else this.sendStateTo(userId, side);
    return side;
  }

  addSpectator(userId: string, connection: unknown): void {
    this.clearEmptyRoomTimer();
    const existing = this.spectators.get(userId);
    if (existing) existing.add(connection);
    else this.spectators.set(userId, new Set([connection]));
    this.sendSpectatorState(userId);
  }

  private removeSpectator(userId: string, connection: unknown): boolean {
    const spectator = this.spectators.get(userId);
    if (!spectator) return false;
    spectator.delete(connection);
    if (spectator.size === 0) this.spectators.delete(userId);
    return true;
  }

  private releaseConnection(
    player: BattleshipPlayer,
    connection: unknown,
  ): boolean {
    player.connections.delete(connection);
    return player.connections.size === 0;
  }

  private resumeExisting(player: BattleshipPlayer) {
    player.connected = true;
    this.disconnectGrace.disarm(player.userId);
    this.broadcaster.broadcastPublic({
      type: 'opponent_reconnected',
      payload: { side: player.side },
    });
    this.broadcastState();
  }

  pauseForDisconnect(userId: string, connection: unknown) {
    if (this.spectators.has(userId)) {
      this.removeSpectator(userId, connection);
      this.maybeStartEmptyRoomTimer();
      return;
    }
    const player = this.players.find((p) => p.userId === userId);
    if (!player) return;
    if (!this.releaseConnection(player, connection)) return;

    if (this.identity.mode !== 'multi' || this.engine.getPhase() === 'ended') {
      this.detach(userId);
      return;
    }
    if (!player.connected) return;

    player.connected = false;
    this.broadcaster.broadcastPublic({
      type: 'opponent_disconnected',
      payload: { side: player.side, timeoutMs: this.disconnectGraceMs },
    });
    this.disconnectGrace.arm(userId, this.disconnectGraceMs, () =>
      this.forfeitDisconnected(userId),
    );
  }

  private forfeitDisconnected(userId: string) {
    const player = this.players.find((p) => p.userId === userId);
    if (!player || player.connected) return;
    this.forfeitTo(userId);
    this.removePlayer(userId);
  }

  private detach(userId: string) {
    this.disconnectGrace.disarm(userId);
    this.forfeitTo(userId);
    this.removePlayer(userId);
  }

  private forfeitTo(userId: string) {
    const remaining = this.players.find(
      (p) => p.userId !== userId && p.connected,
    );
    if (!remaining || this.engine.getPhase() === 'ended') return;

    this.engine.forceWinner(remaining.side);
    this.broadcastState();
    if (!this.resultRecorded) {
      this.resultRecorded = true;
      this.lastWinnerSide = remaining.side;
      this.recordResult(remaining.side);
    }
  }

  private removePlayer(userId: string) {
    this.players = this.players.filter((p) => p.userId !== userId);
    this.maybeStartEmptyRoomTimer();
  }

  // A room reaching zero players AND zero spectators is debounced by this
  // grace window before actually disposing — React 19 StrictMode's dev-only
  // double-mount briefly connects and disconnects a phantom client before
  // the real one joins, and without this grace an empty-room disposal races
  // ahead of that real join and drops it too (observed as "Connection lost"
  // on first load).
  private maybeStartEmptyRoomTimer() {
    if (this.players.length !== 0 || this.spectators.size !== 0) return;
    this.clearEmptyRoomTimer();
    this.emptyRoomTimer = setTimeout(() => {
      this.emptyRoomTimer = null;
      if (this.players.length !== 0 || this.spectators.size !== 0) return;
      this.onSessionEnded?.();
    }, this.emptyRoomGraceMs);
  }

  leave(userId: string, connection: unknown) {
    if (this.spectators.has(userId)) {
      this.removeSpectator(userId, connection);
      this.maybeStartEmptyRoomTimer();
      return;
    }
    const player = this.players.find((p) => p.userId === userId);
    if (!player) return;
    if (!this.releaseConnection(player, connection)) return;
    this.detach(userId);
  }

  placeShips(userId: string, placements: ShipPlacement[]) {
    const player = this.players.find((p) => p.userId === userId);
    if (!player) return;

    const result = this.engine.placeShips(player.side, placements);
    if (!result.ok) {
      this.broadcaster.sendToPlayer(userId, {
        type: 'placement_error',
        payload: { message: result.error },
      });
      return;
    }
    this.broadcastState();
    this.maybeScheduleBotShot();
  }

  fire(userId: string, x: number, y: number) {
    const player = this.players.find((p) => p.userId === userId);
    if (!player) return;

    const result = this.engine.fire(player.side, x, y);
    if (!result.ok) {
      this.broadcaster.sendToPlayer(userId, {
        type: 'fire_error',
        payload: { message: result.error },
      });
      return;
    }

    this.broadcastState();
    if (result.winner && !this.resultRecorded) {
      this.resultRecorded = true;
      this.lastWinnerSide = result.winner;
      this.recordResult(result.winner);
      return;
    }
    this.maybeScheduleBotShot();
  }

  private sendStateTo(userId: string, side: BattleshipSide) {
    this.broadcaster.sendToPlayer(userId, {
      type: 'state',
      payload: viewFor(this.engine, side),
    });
  }

  private sendSpectatorState(userId: string) {
    this.broadcaster.sendToPlayer(userId, {
      type: 'state',
      payload: spectatorViewFor(this.engine),
    });
  }

  private broadcastState() {
    for (const player of this.players) {
      this.sendStateTo(player.userId, player.side);
    }
    for (const userId of this.spectators.keys()) {
      this.sendSpectatorState(userId);
    }
  }

  private recordResult(winner: BattleshipSide) {
    if (this.players.length < 2) return;
    this.gamification.recordGameResult({
      sessionId: this.identity.instanceId,
      guildId: this.identity.guildId,
      gameType: 'battleship',
      results: this.players.map((player) => ({
        userId: player.userId,
        position: player.side === winner ? 1 : 2,
      })),
    });
  }

  // MANDATORY per §6.2: clears disconnect grace so it can't outlive a
  // disposed room.
  dispose(): void {
    this.clearBotTimer();
    this.clearEmptyRoomTimer();
    this.disconnectGrace.clear();
  }

  getWinnerUserId(): string | null {
    if (!this.lastWinnerSide) return null;
    return (
      this.players.find((p) => p.side === this.lastWinnerSide)?.userId ?? null
    );
  }

  // No restart flow exists for Battleship (like RPS) — reset the engine so
  // the newly-paired players go straight back into ship placement instead
  // of leaving the room permanently stuck in the 'ended' phase.
  substitutePlayer(
    outgoingUserId: string,
    incomingUserId: string,
    connection: unknown,
  ): boolean {
    const outgoing = this.players.find((p) => p.userId === outgoingUserId);
    if (!outgoing) return false;

    this.players = this.players.filter((p) => p.userId !== outgoingUserId);
    this.players.push({
      userId: incomingUserId,
      side: outgoing.side,
      connected: true,
      connections: new Set([connection]),
    });

    this.engine = new BattleshipEngine();
    this.resultRecorded = false;
    this.lastWinnerSide = null;
    this.broadcastState();
    return true;
  }
}
