import { chooseCheckersMove } from 'services/activity/checkers/CheckersBotAI';
import {
  CheckersEngine,
  type CheckersState,
  type Color,
  type Position,
} from 'services/activity/checkers/CheckersEngine';
import type { ActivityMode } from 'services/activity/gameId';
import type { ActionResult } from 'services/activity/shared/ActionResult';
import type { ActivityBroadcaster } from 'services/activity/shared/ActivityBroadcaster';
import { DisconnectGraceTimer } from 'services/activity/shared/DisconnectGraceTimer';
import { GamificationService } from 'services/gamification';

interface CheckersPlayer {
  userId: string;
  color: Color;
  connected: boolean;
  // Mirrors PongPlayer's connection bookkeeping: a slot is only released
  // once every socket a user holds on it is gone, so a superseded socket
  // from a reconnect/remount can never evict the one that replaced it.
  connections: Set<unknown>;
}

export interface CheckersSessionIdentity {
  sessionKey: string;
  instanceId: string;
  guildId: string;
  mode: ActivityMode;
}

export interface CheckersSessionOptions {
  onSessionEnded?: () => void;
  disconnectGraceMs?: number;
}

const DEFAULT_DISCONNECT_GRACE_MS = 30_000;
const BOT_MOVE_DELAY_MS = 500;

export class CheckersSession {
  private engine = new CheckersEngine();
  private players: CheckersPlayer[] = [];
  private resultRecorded = false;
  private botColor: Color | null = null;
  private restartVotes = new Set<string>();
  private disconnectGrace = new DisconnectGraceTimer<string>();
  private readonly onSessionEnded?: () => void;
  private readonly disconnectGraceMs: number;
  private botTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private identity: CheckersSessionIdentity,
    private broadcaster: ActivityBroadcaster,
    private gamification: GamificationService = new GamificationService(),
    options: CheckersSessionOptions = {},
  ) {
    this.onSessionEnded = options.onSessionEnded;
    this.disconnectGraceMs =
      options.disconnectGraceMs ?? DEFAULT_DISCONNECT_GRACE_MS;
  }

  get playerCount(): number {
    return this.players.length;
  }

  private get roomKey(): string {
    return this.identity.sessionKey;
  }

  addPlayer(userId: string, connection: unknown): Color | null {
    const existing = this.players.find((p) => p.userId === userId);
    if (existing) {
      existing.connections.add(connection);
      if (!existing.connected) this.resumeExisting(existing);
      return existing.color;
    }
    if (this.players.length >= 2) return null;
    const color: Color = this.players.length === 0 ? 'black' : 'red';
    this.players.push({
      userId,
      color,
      connected: true,
      connections: new Set([connection]),
    });
    return color;
  }

  private releaseConnection(
    player: CheckersPlayer,
    connection: unknown,
  ): boolean {
    player.connections.delete(connection);
    return player.connections.size === 0;
  }

  private resumeExisting(player: CheckersPlayer) {
    player.connected = true;
    this.disconnectGrace.disarm(player.userId);
    this.broadcaster.broadcast(this.roomKey, {
      type: 'opponent_reconnected',
      payload: { color: player.color },
    });
  }

  pauseForDisconnect(userId: string, connection: unknown) {
    const player = this.players.find((p) => p.userId === userId);
    if (!player) return;
    if (!this.releaseConnection(player, connection)) return;

    if (this.identity.mode !== 'multi' || this.engine.getState().winner) {
      this.detach(userId);
      return;
    }
    if (!player.connected) return;

    player.connected = false;
    this.broadcaster.broadcast(this.roomKey, {
      type: 'opponent_disconnected',
      payload: { color: player.color, timeoutMs: this.disconnectGraceMs },
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
    if (!remaining || this.engine.getState().winner) return;

    this.engine.forceWinner(remaining.color);
    const state = this.broadcastState();
    if (!this.resultRecorded) {
      this.resultRecorded = true;
      this.recordResult(state.winner!);
    }
  }

  private removePlayer(userId: string) {
    this.players = this.players.filter((p) => p.userId !== userId);
    this.restartVotes.delete(userId);
    if (this.players.length === 0) this.onSessionEnded?.();
  }

  leave(userId: string, connection: unknown) {
    const player = this.players.find((p) => p.userId === userId);
    if (!player) return;
    if (!this.releaseConnection(player, connection)) return;

    this.detach(userId);
  }

  getWinnerUserId(): string | null {
    const winner = this.engine.getState().winner;
    if (!winner) return null;
    return this.players.find((p) => p.color === winner)?.userId ?? null;
  }

  substitutePlayer(
    outgoingUserId: string,
    incomingUserId: string,
    connection: unknown,
  ): boolean {
    const outgoing = this.players.find((p) => p.userId === outgoingUserId);
    if (!outgoing) return false;

    this.players = this.players.filter((p) => p.userId !== outgoingUserId);
    this.restartVotes.delete(outgoingUserId);
    this.players.push({
      userId: incomingUserId,
      color: outgoing.color,
      connected: true,
      connections: new Set([connection]),
    });
    return true;
  }

  enableBot(humanColor?: Color) {
    this.botColor = humanColor === 'black' ? 'red' : 'black';
  }

  getPublicState() {
    return this.engine.getState();
  }

  // Returns the outcome instead of broadcasting a rejection — a rejected
  // move is feedback for the mover only, so the Room delivers it via
  // `client.send`, never a room-wide broadcast (§6.3, AP-1).
  requestMove(userId: string, from: Position, to: Position): ActionResult {
    const player = this.players.find((p) => p.userId === userId);
    if (!player) return { ok: false, error: 'Not seated at this match' };

    const result = this.engine.move(player.color, from, to);
    if (!result.ok) {
      return { ok: false, error: result.error ?? 'Invalid move' };
    }

    const state = this.broadcastState();
    if (state.winner && !this.resultRecorded) {
      this.resultRecorded = true;
      this.recordResult(state.winner);
      return { ok: true };
    }

    this.maybeScheduleBotMove();
    return { ok: true };
  }

  private maybeScheduleBotMove() {
    if (!this.botColor) return;
    const state = this.engine.getState();
    if (state.winner) return;
    if (state.turn !== this.botColor) return;
    if (this.botTimer) return;

    this.botTimer = setTimeout(() => {
      this.botTimer = null;
      this.playBotMove();
    }, BOT_MOVE_DELAY_MS);
  }

  private playBotMove() {
    const state = this.engine.getState();
    if (state.winner || state.turn !== this.botColor) return;

    const move = chooseCheckersMove(this.engine, this.botColor!);
    if (!move) return;

    const result = this.engine.move(this.botColor!, move.from, move.to);
    if (!result.ok) return;

    const newState = this.broadcastState();
    if (newState.winner && !this.resultRecorded) {
      this.resultRecorded = true;
      this.recordResult(newState.winner);
      return;
    }

    this.maybeScheduleBotMove();
  }

  requestRestart(userId: string) {
    const state = this.engine.getState();
    if (!state.winner) return;
    if (!this.players.some((p) => p.userId === userId)) return;

    this.restartVotes.add(userId);
    const required = this.botColor ? 1 : this.players.length;

    if (this.restartVotes.size < required) {
      this.broadcaster.broadcast(this.roomKey, {
        type: 'restart_status',
        payload: { votes: this.restartVotes.size, required },
      });
      return;
    }

    this.restartVotes.clear();
    this.resultRecorded = false;
    this.engine = new CheckersEngine();
    this.broadcastState();
    this.maybeScheduleBotMove();
  }

  dispose() {
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }
    this.disconnectGrace.clear();
  }

  private broadcastState(): CheckersState {
    const state = this.engine.getState();
    this.broadcaster.broadcast(this.roomKey, {
      type: 'state',
      payload: state,
    });
    return state;
  }

  private recordResult(winner: Color) {
    if (this.players.length < 2) return;
    this.gamification.recordGameResult({
      sessionId: this.identity.instanceId,
      guildId: this.identity.guildId,
      gameType: 'checkers',
      results: this.players.map((player) => ({
        userId: player.userId,
        position: player.color === winner ? 1 : 2,
      })),
    });
  }
}
