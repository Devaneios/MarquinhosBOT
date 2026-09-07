import {
  BingoSpeedEngine,
  type BingoCard,
} from 'services/activity/bingoSpeed/BingoSpeedEngine';
import type { ActivityMode } from 'services/activity/gameId';
import type { ActivityBroadcaster } from 'services/activity/shared/ActivityBroadcaster';
import { DisconnectGraceTimer } from 'services/activity/shared/DisconnectGraceTimer';
import { GamificationService } from 'services/gamification';

interface BingoPlayer {
  userId: string;
  card: BingoCard;
  connected: boolean;
  // See PongSession: released only when the last connection drops, so a
  // superseded socket closing can never evict the one that replaced it
  // (§6.2 — previously missing entirely, AP-7).
  connections: Set<unknown>;
}

export interface BingoSpeedSessionIdentity {
  sessionKey: string;
  instanceId: string;
  guildId: string;
  mode: ActivityMode;
}

export interface BingoSpeedSessionOptions {
  drawIntervalMs?: number;
  onSessionEnded?: () => void;
  disconnectGraceMs?: number;
  emptyRoomGraceMs?: number;
}

export interface BingoSpeedPublicState {
  playerCount: number;
  drawnNumbers: number[];
  gameStarted: boolean;
  winner: string | null;
}

const DEFAULT_DRAW_INTERVAL_MS = 3000;
const DEFAULT_DISCONNECT_GRACE_MS = 30_000;
// A room reaching zero players is debounced by this grace window before
// actually disposing — React 19 StrictMode's dev-only double-mount briefly
// connects and disconnects a phantom client before the real one joins, and
// without this grace an empty-room disposal races ahead of that real join
// and drops it too (observed as "Connection lost" on first load).
const DEFAULT_EMPTY_ROOM_GRACE_MS = 1500;

export class BingoSpeedSession {
  private engine: BingoSpeedEngine;
  private players: Map<string, BingoPlayer> = new Map();
  private drawInterval: ReturnType<typeof setInterval> | null = null;
  private resultRecorded = false;
  private winner: string | null = null;
  private readonly drawIntervalMs: number;
  private readonly disconnectGraceMs: number;
  private disconnectGrace = new DisconnectGraceTimer<string>();
  private readonly onSessionEnded?: () => void;
  // Mirrors Pong's "freeze the whole loop" rule (§6.2): while any multi
  // player is in disconnect grace, drawing stops so the board doesn't move
  // on without them. Tracked as a set because more than one player can be
  // mid-grace at once; the loop only resumes once it's empty.
  private pausedForDisconnect = new Set<string>();
  private everStarted = false;
  private readonly emptyRoomGraceMs: number;
  private emptyRoomTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private identity: BingoSpeedSessionIdentity,
    private broadcaster: ActivityBroadcaster,
    private gamification: GamificationService = new GamificationService(),
    options: BingoSpeedSessionOptions = {},
  ) {
    this.engine = new BingoSpeedEngine();
    this.drawIntervalMs = options.drawIntervalMs ?? DEFAULT_DRAW_INTERVAL_MS;
    this.disconnectGraceMs =
      options.disconnectGraceMs ?? DEFAULT_DISCONNECT_GRACE_MS;
    this.onSessionEnded = options.onSessionEnded;
    this.emptyRoomGraceMs =
      options.emptyRoomGraceMs ?? DEFAULT_EMPTY_ROOM_GRACE_MS;
  }

  private clearEmptyRoomTimer() {
    if (this.emptyRoomTimer) {
      clearTimeout(this.emptyRoomTimer);
      this.emptyRoomTimer = null;
    }
  }

  get playerCount(): number {
    return this.players.size;
  }

  private get roomKey(): string {
    return this.identity.sessionKey;
  }

  addPlayer(userId: string, connection: unknown): BingoCard | null {
    this.clearEmptyRoomTimer();
    const existing = this.players.get(userId);
    if (existing) {
      existing.connections.add(connection);
      if (!existing.connected) {
        existing.connected = true;
        this.disconnectGrace.disarm(userId);
        this.broadcaster.broadcast(this.roomKey, {
          type: 'opponent_reconnected',
          payload: { userId },
        });
        this.resumeIfNoOneElsePaused(userId);
      }
      return existing.card;
    }

    if (this.players.size >= 4) return null; // Limit to 4 players

    const card = this.engine.generateCard();
    this.players.set(userId, {
      userId,
      card,
      connected: true,
      connections: new Set([connection]),
    });

    return card;
  }

  // True when `connection` was the last socket holding the slot.
  private releaseConnection(player: BingoPlayer, connection: unknown): boolean {
    player.connections.delete(connection);
    return player.connections.size === 0;
  }

  private removePlayer(userId: string): void {
    this.disconnectGrace.disarm(userId);
    this.players.delete(userId);
    if (this.players.size === 0) {
      this.clearEmptyRoomTimer();
      this.emptyRoomTimer = setTimeout(() => {
        this.emptyRoomTimer = null;
        if (this.players.size !== 0) return;
        this.stop();
        this.onSessionEnded?.();
      }, this.emptyRoomGraceMs);
      return;
    }
    this.resumeIfNoOneElsePaused(userId);
  }

  // Resumes drawing once the given (now-reconnected-or-removed) player is no
  // longer holding up the freeze, provided no one else still is and the
  // round hasn't already ended.
  private resumeIfNoOneElsePaused(userId: string): void {
    this.pausedForDisconnect.delete(userId);
    if (this.pausedForDisconnect.size > 0) return;
    if (this.winner || !this.everStarted) return;
    this.start();
  }

  // Socket dropped without an explicit `leave` — a network blip. Only
  // 'multi' with the round still live holds the slot for a reconnect;
  // otherwise (single/local, or the round already has a winner) it degrades
  // to an immediate detach (§6.2).
  pauseForDisconnect(userId: string, connection: unknown): void {
    const player = this.players.get(userId);
    if (!player) return;
    if (!this.releaseConnection(player, connection)) return;

    if (this.identity.mode !== 'multi' || this.winner) {
      this.removePlayer(userId);
      return;
    }
    if (!player.connected) return;

    player.connected = false;
    // Freezes the draw loop for everyone (§6.2, same rule as Pong) so the
    // disconnected player doesn't come back to a board full of numbers
    // called while they were gone.
    this.pausedForDisconnect.add(userId);
    this.stop();
    this.broadcaster.broadcast(this.roomKey, {
      type: 'opponent_disconnected',
      payload: { userId, timeoutMs: this.disconnectGraceMs },
    });
    this.disconnectGrace.arm(userId, this.disconnectGraceMs, () => {
      const p = this.players.get(userId);
      if (p && !p.connected) this.removePlayer(userId);
    });
  }

  // Deliberate exit: no grace, slot freed now.
  leave(userId: string, connection: unknown): void {
    const player = this.players.get(userId);
    if (!player) return;
    if (!this.releaseConnection(player, connection)) return;

    this.removePlayer(userId);
  }

  start(): void {
    if (this.drawInterval) return;

    this.drawInterval = setInterval(() => this.tick(), this.drawIntervalMs);
    // Only the very first start announces `game_started` — resuming after a
    // disconnect-grace freeze (resumeIfNoOneElsePaused) restarts the same
    // interval, not a new round, so it stays silent here and relies on the
    // `opponent_reconnected` broadcast already sent by the caller.
    if (!this.everStarted) {
      this.everStarted = true;
      this.broadcaster.broadcast(this.roomKey, {
        type: 'game_started',
        payload: {},
      });
    }
  }

  stop(): void {
    if (this.drawInterval) {
      clearInterval(this.drawInterval);
      this.drawInterval = null;
    }
  }

  private tick(): void {
    const number = this.engine.drawNumber();
    if (number === null) {
      this.stop();
      return;
    }

    // Mark the number on all player cards
    for (const player of this.players.values()) {
      this.engine.markNumber(player.card, number);
    }

    // Check for bingo
    for (const player of this.players.values()) {
      if (this.engine.checkBingo(player.card)) {
        this.winner = player.userId;
        if (!this.resultRecorded) {
          this.recordResult(player.userId);
          this.resultRecorded = true;
        }
        this.broadcastGameEnd(player.userId);
        this.stop();
        return;
      }
    }

    this.broadcastNumberDrawn(number);
  }

  markNumber(userId: string, number: number): void {
    const player = this.players.get(userId);
    if (!player) return;

    this.engine.markNumber(player.card, number);
  }

  claimBingo(userId: string): { success: boolean } | { error: string } {
    const player = this.players.get(userId);
    if (!player) {
      return { error: 'Player not found' };
    }

    if (!this.engine.checkBingo(player.card)) {
      return { error: 'No bingo on your card' };
    }

    if (!this.engine.verifyBingoClaim(player.card, 0)) {
      return { error: 'Bingo claim is invalid - not all numbers were drawn' };
    }

    this.winner = userId;
    if (!this.resultRecorded) {
      this.recordResult(userId);
      this.resultRecorded = true;
    }

    this.broadcastGameEnd(userId);
    this.stop();

    return { success: true };
  }

  private broadcastNumberDrawn(number: number): void {
    this.broadcaster.broadcast(this.roomKey, {
      type: 'number_drawn',
      payload: { number },
    });
  }

  private broadcastGameEnd(winnerId: string): void {
    this.broadcaster.broadcast(this.roomKey, {
      type: 'game_end',
      payload: { winner: winnerId },
    });
  }

  getPublicState(): BingoSpeedPublicState {
    return {
      playerCount: this.players.size,
      drawnNumbers: this.engine.getState().drawnNumbers,
      gameStarted: this.drawInterval !== null,
      winner: this.winner,
    };
  }

  getPlayerCard(userId: string): BingoCard | null {
    return this.players.get(userId)?.card ?? null;
  }

  private recordResult(winnerId: string): void {
    const players = Array.from(this.players.values());
    if (players.length < 2) return;

    this.gamification.recordGameResult({
      sessionId: this.identity.instanceId,
      guildId: this.identity.guildId,
      gameType: 'bingo-speed',
      results: players.map((player) => ({
        userId: player.userId,
        position: player.userId === winnerId ? 1 : 2,
      })),
    });
  }

  // MANDATORY per §6.2: stops the draw interval and clears disconnect grace
  // so neither outlives a disposed room.
  dispose(): void {
    this.clearEmptyRoomTimer();
    this.stop();
    this.disconnectGrace.clear();
  }
}
