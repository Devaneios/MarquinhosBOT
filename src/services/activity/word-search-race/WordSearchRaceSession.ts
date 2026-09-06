import type { ActivityMode } from 'services/activity/gameId';
import type { ActivityBroadcaster } from 'services/activity/shared/ActivityBroadcaster';
import type {
  Cell,
  FoundWord,
} from 'services/activity/word-search-race/WordSearchRaceEngine';
import { WordSearchRaceEngine } from 'services/activity/word-search-race/WordSearchRaceEngine';
import { GamificationService } from 'services/gamification';

interface WordSearchRacePlayer {
  userId: string;
  connections: Set<unknown>;
}

// Mirrors PongSessionIdentity: the room key doubles as the broadcast key,
// instanceId/guildId are kept only for the gamification record.
export interface WordSearchRaceSessionIdentity {
  sessionKey: string;
  instanceId: string;
  guildId: string;
  mode: ActivityMode;
}

export interface WordSearchRaceSessionOptions {
  onSessionEnded?: () => void;
  timeLimitMs?: number;
  emptyRoomGraceMs?: number;
}

// Unlike Pong, this game has no turn order or adversarial forfeit — players
// join and leave a shared puzzle freely, so 3 minutes is simply "long enough
// to hunt every word on a 12x12 board without dragging a stalled room on
// forever."
const DEFAULT_TIME_LIMIT_MS = 3 * 60_000;

// A room reaching zero players is debounced by this grace window before
// actually disposing — React 19 StrictMode's dev-only double-mount briefly
// connects and disconnects a phantom client before the real one joins, and
// without this grace an empty-room disposal races ahead of that real join
// and drops it too (observed as "Connection lost" on first load).
const DEFAULT_EMPTY_ROOM_GRACE_MS = 1500;

export class WordSearchRaceSession {
  private engine: WordSearchRaceEngine;
  private players: WordSearchRacePlayer[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly startedAt: number;
  private readonly timeLimitMs: number;
  private ended = false;
  private resultRecorded = false;
  private readonly onSessionEnded?: () => void;
  private readonly emptyRoomGraceMs: number;
  private emptyRoomTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private identity: WordSearchRaceSessionIdentity,
    private broadcaster: ActivityBroadcaster,
    private gamification: GamificationService = new GamificationService(),
    options: WordSearchRaceSessionOptions = {},
  ) {
    this.engine = new WordSearchRaceEngine();
    this.timeLimitMs = options.timeLimitMs ?? DEFAULT_TIME_LIMIT_MS;
    this.onSessionEnded = options.onSessionEnded;
    this.emptyRoomGraceMs =
      options.emptyRoomGraceMs ?? DEFAULT_EMPTY_ROOM_GRACE_MS;
    this.startedAt = Date.now();
    this.timer = setTimeout(() => this.endGame('timeout'), this.timeLimitMs);
  }

  private get roomKey(): string {
    return this.identity.sessionKey;
  }

  get playerCount(): number {
    return this.players.length;
  }

  getDeadline(): number {
    return this.startedAt + this.timeLimitMs;
  }

  getPublicState() {
    return {
      size: this.engine.getSize(),
      grid: this.engine.getGrid(),
      words: this.engine.getWords(),
      found: this.engine.getFound(),
      scores: this.engine.getScores(),
      deadline: this.getDeadline(),
      ended: this.ended,
    };
  }

  addPlayer(userId: string, connection: unknown): void {
    this.clearEmptyRoomTimer();
    const existing = this.players.find((p) => p.userId === userId);
    if (existing) {
      existing.connections.add(connection);
      return;
    }
    this.players.push({ userId, connections: new Set([connection]) });
  }

  removePlayer(userId: string, connection: unknown): void {
    const player = this.players.find((p) => p.userId === userId);
    if (!player) return;
    player.connections.delete(connection);
    if (player.connections.size > 0) return;

    this.players = this.players.filter((p) => p.userId !== userId);
    if (this.players.length === 0) this.clearTimerAndNotifyEnded();
  }

  submitSelection(
    userId: string,
    start: Cell,
    end: Cell,
  ): FoundWord | { error: string } {
    if (this.ended) return { error: 'Game has already ended' };
    if (!this.players.some((p) => p.userId === userId)) {
      return { error: 'Player not in room' };
    }

    const result = this.engine.submitSelection(userId, start, end);
    if ('error' in result) return result;

    this.broadcaster.broadcast(this.roomKey, {
      type: 'word_found',
      payload: { ...result, scores: this.engine.getScores() },
    });

    if (this.engine.isComplete()) this.endGame('completed');

    return result;
  }

  private endGame(reason: 'completed' | 'timeout') {
    if (this.ended) return;
    this.ended = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.broadcaster.broadcast(this.roomKey, {
      type: 'game_over',
      payload: { reason, scores: this.engine.getScores() },
    });

    this.recordResult();
  }

  // Competition ranking: players tied on score share the same position, and
  // the next distinct score skips ahead by the number of players it tied
  // with (1,1,3 — never 1,1,2).
  private recordResult() {
    if (this.resultRecorded || this.players.length === 0) return;
    this.resultRecorded = true;

    const scores = this.engine.getScores();
    const ranked = [...this.players]
      .map((p) => ({ userId: p.userId, score: scores[p.userId] ?? 0 }))
      .sort((a, b) => b.score - a.score);

    this.gamification.recordGameResult({
      sessionId: this.identity.instanceId,
      guildId: this.identity.guildId,
      gameType: 'word-search-race',
      results: ranked.map((entry, index) => ({
        userId: entry.userId,
        position:
          index === 0 || entry.score !== ranked[index - 1]!.score
            ? index + 1
            : ranked.findIndex((r) => r.score === entry.score) + 1,
      })),
    });
  }

  private clearEmptyRoomTimer() {
    if (this.emptyRoomTimer) {
      clearTimeout(this.emptyRoomTimer);
      this.emptyRoomTimer = null;
    }
  }

  private clearTimerAndNotifyEnded() {
    this.clearEmptyRoomTimer();
    this.emptyRoomTimer = setTimeout(() => {
      this.emptyRoomTimer = null;
      if (this.players.length !== 0) return;
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
      this.onSessionEnded?.();
    }, this.emptyRoomGraceMs);
  }

  // MANDATORY per §6.2: clears the round timer so it can't fire into a
  // disposed room. No `onSessionEnded` call here — the Room is already
  // tearing itself down when this runs.
  dispose(): void {
    this.clearEmptyRoomTimer();
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
