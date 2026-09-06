import { SeededRng } from 'services/activity/cards/core/rng';
import type { ActivityMode } from 'services/activity/gameId';
import type { ActionResult } from 'services/activity/shared/ActionResult';
import type { ActivityBroadcaster } from 'services/activity/shared/ActivityBroadcaster';
import { DisconnectGraceTimer } from 'services/activity/shared/DisconnectGraceTimer';
import {
  TOWER_BOT_USER_ID,
  TowerBot,
} from 'services/activity/towerUnstable/TowerBot';
import {
  TowerEngine,
  type TowerState,
} from 'services/activity/towerUnstable/TowerEngine';
import { GamificationService } from 'services/gamification';

interface TowerPlayer {
  userId: string;
  connected: boolean;
  connections: Set<unknown>;
}

export interface TowerSessionIdentity {
  sessionKey: string;
  instanceId: string;
  guildId: string;
  mode: ActivityMode;
}

export interface TowerSessionOptions {
  onSessionEnded?: () => void;
  disconnectGraceMs?: number;
  // Only for tests: pins the tower's topple rolls to a known sequence
  // instead of a fresh SeededRng.randomSeed() every match.
  seed?: number;
  botMoveDelayMs?: number;
  emptyRoomGraceMs?: number;
}

const MAX_PLAYERS = 2;
const DEFAULT_DISCONNECT_GRACE_MS = 30_000;
const DEFAULT_BOT_MOVE_DELAY_MS = 700;
const DEFAULT_EMPTY_ROOM_GRACE_MS = 1500;

export class TowerSession {
  private engine: TowerEngine | null = null;
  private players: TowerPlayer[] = [];
  private resultRecorded = false;
  private restartVotes = new Set<string>();
  private disconnectGrace = new DisconnectGraceTimer<string>();
  private readonly onSessionEnded?: () => void;
  private readonly disconnectGraceMs: number;
  private readonly seed?: number;
  private botUserId: string | null = null;
  private bot: TowerBot | null = null;
  private readonly botMoveDelayMs: number;
  private botTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly emptyRoomGraceMs: number;
  private emptyRoomTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private identity: TowerSessionIdentity,
    private broadcaster: ActivityBroadcaster,
    private gamification: GamificationService = new GamificationService(),
    options: TowerSessionOptions = {},
  ) {
    this.onSessionEnded = options.onSessionEnded;
    this.disconnectGraceMs =
      options.disconnectGraceMs ?? DEFAULT_DISCONNECT_GRACE_MS;
    this.seed = options.seed;
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

  get playerCount(): number {
    return this.players.length;
  }

  private get roomKey(): string {
    return this.identity.sessionKey;
  }

  addPlayer(userId: string, connection: unknown): boolean {
    this.clearEmptyRoomTimer();
    const existing = this.players.find((p) => p.userId === userId);
    if (existing) {
      existing.connections.add(connection);
      if (!existing.connected) this.resumeExisting(existing);
      return true;
    }
    if (this.players.length >= MAX_PLAYERS) return false;
    this.players.push({
      userId,
      connected: true,
      connections: new Set([connection]),
    });

    if (this.players.length === MAX_PLAYERS) {
      this.engine = new TowerEngine(
        this.players.map((p) => p.userId),
        this.seed ?? SeededRng.randomSeed(),
      );
      this.maybeScheduleBotPull();
    }
    return true;
  }

  // Seats the bot as a genuine player — the engine requires exactly
  // MAX_PLAYERS to start, and there's no "virtual side" here the way a
  // masked board game has.
  enableBot(): void {
    if (this.botUserId) return;
    this.botUserId = TOWER_BOT_USER_ID;
    this.bot = new TowerBot();
    this.addPlayer(this.botUserId, null);
  }

  private clearBotTimer(): void {
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }
  }

  private maybeScheduleBotPull(): void {
    if (!this.bot || !this.botUserId || !this.engine) return;
    const state = this.engine.getState();
    if (state.status !== 'playing') return;
    if (state.currentPlayer !== this.botUserId) return;
    if (this.botTimer) return;

    this.botTimer = setTimeout(() => {
      this.botTimer = null;
      this.playBotPull();
    }, this.botMoveDelayMs);
  }

  private playBotPull(): void {
    if (!this.bot || !this.botUserId || !this.engine) return;
    const state = this.engine.getState();
    if (state.status !== 'playing' || state.currentPlayer !== this.botUserId) {
      return;
    }

    const move = this.bot.choosePull(state);
    if (!move) return;

    const result = this.engine.pull(this.botUserId, move.level, move.position);
    if (!result.success) return;

    const updated = this.broadcastState();
    if (updated.status === 'ended' && updated.winner && !this.resultRecorded) {
      this.resultRecorded = true;
      this.recordResult(updated.winner);
      return;
    }
    this.maybeScheduleBotPull();
  }

  private releaseConnection(player: TowerPlayer, connection: unknown): boolean {
    player.connections.delete(connection);
    return player.connections.size === 0;
  }

  private resumeExisting(player: TowerPlayer) {
    player.connected = true;
    this.disconnectGrace.disarm(player.userId);
    this.broadcaster.broadcast(this.roomKey, {
      type: 'opponent_reconnected',
      payload: { userId: player.userId },
    });
  }

  pauseForDisconnect(userId: string, connection: unknown) {
    const player = this.players.find((p) => p.userId === userId);
    if (!player) return;
    if (!this.releaseConnection(player, connection)) return;

    const state = this.engine?.getState();
    if (this.identity.mode !== 'multi' || !state || state.status === 'ended') {
      this.detach(userId);
      return;
    }
    if (!player.connected) return;

    player.connected = false;
    this.broadcaster.broadcast(this.roomKey, {
      type: 'opponent_disconnected',
      payload: { userId, timeoutMs: this.disconnectGraceMs },
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
    if (!this.engine) return;
    const state = this.engine.getState();
    if (state.status === 'ended') return;

    this.engine.forceEliminate(userId);
    const updated = this.broadcastState();
    if (!this.resultRecorded && updated.status === 'ended' && updated.winner) {
      this.resultRecorded = true;
      this.recordResult(updated.winner);
    }
  }

  private removePlayer(userId: string) {
    this.players = this.players.filter((p) => p.userId !== userId);
    this.restartVotes.delete(userId);
    // The bot's own seat never leaves via detach/leave (it has no real
    // connection), so once every *real* player is gone the table is just
    // as empty as if `players` were literally [].
    const realPlayers = this.players.filter((p) => p.userId !== this.botUserId);
    if (realPlayers.length === 0) {
      this.clearBotTimer();
      this.clearEmptyRoomTimer();
      // Debounced by this grace window before actually disposing — React
      // 19 StrictMode's dev-only double-mount briefly connects and
      // disconnects a phantom client before the real one joins, and
      // without this grace an empty-room disposal races ahead of that
      // real join and drops it too (observed as "Connection lost" on
      // first load).
      this.emptyRoomTimer = setTimeout(() => {
        this.emptyRoomTimer = null;
        const stillReal = this.players.filter(
          (p) => p.userId !== this.botUserId,
        );
        if (stillReal.length !== 0) return;
        this.onSessionEnded?.();
      }, this.emptyRoomGraceMs);
    }
  }

  leave(userId: string, connection: unknown) {
    const player = this.players.find((p) => p.userId === userId);
    if (!player) return;
    if (!this.releaseConnection(player, connection)) return;

    this.detach(userId);
  }

  // Returns the outcome instead of broadcasting a rejection — a rejected
  // pull is feedback for the requester only, so the Room delivers it via
  // `client.send`, never a room-wide broadcast (§6.3, AP-1).
  handlePull(userId: string, level: number, position: number): ActionResult {
    if (!this.players.some((p) => p.userId === userId)) {
      return { ok: false, error: 'Not seated at this match' };
    }
    if (!this.engine) return { ok: false, error: 'Match not started' };

    const result = this.engine.pull(userId, level, position);

    if (!result.success) {
      return { ok: false, error: result.error ?? 'Invalid pull' };
    }

    const state = this.broadcastState();

    if (state.status === 'ended' && state.winner && !this.resultRecorded) {
      this.resultRecorded = true;
      this.recordResult(state.winner);
      return { ok: true };
    }

    this.maybeScheduleBotPull();
    return { ok: true };
  }

  private broadcastState(): TowerState {
    const state = this.engine!.getState();
    // Payload shape must match 'game_ready' (`{ state }`), which is what
    // the client's applyState() unwraps for both message types — sending
    // the bare state here crashed the client on every pull with
    // "Cannot read properties of undefined (reading 'lastPull')".
    this.broadcaster.broadcast(this.roomKey, {
      type: 'state_update',
      payload: { state },
    });
    return state;
  }

  requestRestart(userId: string) {
    const state = this.engine?.getState();
    if (!state || state.status !== 'ended') return;
    if (!this.players.some((p) => p.userId === userId)) return;

    this.restartVotes.add(userId);
    // The bot always "votes" — it can't click a restart button.
    const required = this.players.filter(
      (p) => p.userId !== this.botUserId,
    ).length;

    if (this.restartVotes.size < required) {
      this.broadcaster.broadcast(this.roomKey, {
        type: 'restart_status',
        payload: { votes: this.restartVotes.size, required },
      });
      return;
    }

    this.restartVotes.clear();
    this.resultRecorded = false;
    this.engine = new TowerEngine(
      this.players.map((p) => p.userId),
      this.seed ?? SeededRng.randomSeed(),
    );
    this.broadcastState();
    this.maybeScheduleBotPull();
  }

  getPublicState(): TowerState | null {
    return this.engine?.getState() ?? null;
  }

  private recordResult(winner: string) {
    // Bot matches have only one real outcome to track and no opponent to
    // rank against — matches the fleet-wide convention of skipping
    // gamification recording in solo/bot mode.
    if (this.players.length < 2 || this.botUserId) return;
    this.gamification.recordGameResult({
      sessionId: this.identity.instanceId,
      guildId: this.identity.guildId,
      gameType: 'tower-unstable',
      results: this.players.map((player) => ({
        userId: player.userId,
        position: player.userId === winner ? 1 : 2,
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
}
