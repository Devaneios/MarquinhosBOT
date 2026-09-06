import {
  BoggleEngine,
  GAME_DURATION_MS,
  type BoggleEngineOptions,
  type Cell,
  type SubmitResult,
} from 'services/activity/boggle/BoggleEngine';
import { getBoggleWordSet } from 'services/activity/boggle/boggleWords';
import type { ActivityMode } from 'services/activity/gameId';
import type { ActivityBroadcaster } from 'services/activity/shared/ActivityBroadcaster';
import { DisconnectGraceTimer } from 'services/activity/shared/DisconnectGraceTimer';
import { GamificationService } from 'services/gamification';

interface BogglePlayer {
  userId: string;
  connected: boolean;
  connections: Set<unknown>;
}

export interface BoggleSessionIdentity {
  sessionKey: string;
  instanceId: string;
  guildId: string;
  mode: ActivityMode;
}

export interface BoggleSessionOptions {
  onSessionEnded?: () => void;
  disconnectGraceMs?: number;
  engineOptions?: Partial<BoggleEngineOptions>;
}

const DEFAULT_DISCONNECT_GRACE_MS = 30_000;

export class BoggleSession {
  private engine: BoggleEngine;
  private players: BogglePlayer[] = [];
  private resultRecorded = false;
  private disconnectGrace = new DisconnectGraceTimer<string>();
  private readonly onSessionEnded?: () => void;
  private readonly disconnectGraceMs: number;
  private endTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private identity: BoggleSessionIdentity,
    private broadcaster: ActivityBroadcaster,
    private gamification: GamificationService = new GamificationService(),
    options: BoggleSessionOptions = {},
  ) {
    this.engine = new BoggleEngine({
      wordSet: options.engineOptions?.wordSet ?? getBoggleWordSet(),
      grid: options.engineOptions?.grid,
      durationMs: options.engineOptions?.durationMs ?? GAME_DURATION_MS,
      random: options.engineOptions?.random,
    });
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

  addPlayer(userId: string, connection: unknown): void {
    const existing = this.players.find((p) => p.userId === userId);
    if (existing) {
      existing.connections.add(connection);
      if (!existing.connected) this.resumeExisting(existing);
      return;
    }
    this.players.push({
      userId,
      connected: true,
      connections: new Set([connection]),
    });
    this.engine.addPlayer(userId);

    // The clock starts on the first join and never resets — Boggle is a
    // shared timer for the whole room, not a per-player countdown, so late
    // joiners simply get less time rather than restarting the round.
    if (!this.engine.isStarted) this.startRound();
  }

  private resumeExisting(player: BogglePlayer) {
    player.connected = true;
    this.disconnectGrace.disarm(player.userId);
  }

  private startRound() {
    this.engine.start();
    const durationMs = this.engine.timeRemainingMs();
    this.endTimer = setTimeout(() => this.endRound(), durationMs);
  }

  getPublicGrid(): string[][] {
    return this.engine.grid;
  }

  getState() {
    return this.engine.getState();
  }

  submitWord(userId: string, path: Cell[]): SubmitResult {
    const result = this.engine.submitWord(userId, path);
    if (result.accepted) {
      this.broadcaster.broadcast(this.roomKey, {
        type: 'word_accepted',
        payload: {
          userId,
          word: result.word,
          points: result.points,
          totalScore: result.totalScore,
        },
      });
    }
    if (this.engine.isEnded && !this.resultRecorded) this.endRound();
    return result;
  }

  private endRound() {
    if (this.endTimer) {
      clearTimeout(this.endTimer);
      this.endTimer = null;
    }
    this.engine.end();

    if (!this.resultRecorded) {
      this.resultRecorded = true;
      const finalResults = this.engine.getFinalResults();
      this.broadcaster.broadcast(this.roomKey, {
        type: 'game_over',
        payload: { results: finalResults },
      });
      this.recordResult(finalResults);
    }
  }

  // Dense ranking (ties share a position, the next distinct score continues
  // at rank+1) — mirrors the tie tolerance CardTableSession/GameDefinition
  // already document for GamificationService.recordGameResult.
  private recordResult(finalResults: { userId: string; score: number }[]) {
    if (this.players.length === 0) return;
    let position = 0;
    let lastScore: number | null = null;
    const results = finalResults.map((r) => {
      if (lastScore === null || r.score !== lastScore) {
        position += 1;
        lastScore = r.score;
      }
      return { userId: r.userId, position };
    });

    this.gamification.recordGameResult({
      sessionId: this.identity.instanceId,
      guildId: this.identity.guildId,
      gameType: 'boggle-word-race',
      results,
    });
  }

  pauseForDisconnect(userId: string, connection: unknown) {
    const player = this.players.find((p) => p.userId === userId);
    if (!player) return;
    player.connections.delete(connection);
    if (player.connections.size > 0) return;

    // Only 'multi' holds the slot open for a reconnect; single mode has no
    // opponent waiting, and a finished round has nothing left to hold open
    // (§6.2).
    if (this.identity.mode !== 'multi' || this.resultRecorded) {
      this.forceDisconnect(userId);
      return;
    }

    player.connected = false;
    this.disconnectGrace.arm(userId, this.disconnectGraceMs, () =>
      this.forceDisconnect(userId),
    );
  }

  private forceDisconnect(userId: string) {
    const idx = this.players.findIndex((p) => p.userId === userId);
    if (idx === -1) return;
    this.players.splice(idx, 1);
    if (this.players.length === 0) {
      if (this.endTimer) {
        clearTimeout(this.endTimer);
        this.endTimer = null;
      }
      this.onSessionEnded?.();
    }
  }

  leave(userId: string, connection: unknown) {
    const player = this.players.find((p) => p.userId === userId);
    if (!player) return;
    player.connections.delete(connection);
    if (player.connections.size > 0) return;

    this.disconnectGrace.disarm(userId);
    this.players = this.players.filter((p) => p.userId !== userId);
    if (this.players.length === 0) {
      if (this.endTimer) {
        clearTimeout(this.endTimer);
        this.endTimer = null;
      }
      this.onSessionEnded?.();
    }
  }

  dispose() {
    if (this.endTimer) {
      clearTimeout(this.endTimer);
      this.endTimer = null;
    }
    this.disconnectGrace.clear();
  }
}
