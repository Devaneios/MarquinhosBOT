import {
  MinesweeperEngine,
  type MinesweeperEngineConfig,
} from 'services/activity/minesweeper/MinesweeperEngine';
import type { ActivityBroadcaster } from 'services/activity/shared/ActivityBroadcaster';
import { GamificationService } from 'services/gamification';

interface MinesweeperPlayer {
  userId: string;
  connections: Set<unknown>;
}

// Unlike Pong/cards, there's no fixed opponent slot and no turn to forfeit —
// any player can reveal any tile at any time, so the session only needs to
// track who has joined (for scoring/gamification) and let disconnects come
// and go freely without pausing the board for everyone else.
export interface MinesweeperSessionIdentity {
  sessionKey: string;
  instanceId: string;
  guildId: string;
}

export interface MinesweeperSessionOptions {
  onSessionEnded?: () => void;
  emptyRoomGraceMs?: number;
}

// A room reaching zero players is debounced by this grace window before
// actually disposing — React 19 StrictMode's dev-only double-mount briefly
// connects and disconnects a phantom client before the real one joins, and
// without this grace an empty-room disposal races ahead of that real join
// and drops it too (observed as "Connection lost" on first load).
const DEFAULT_EMPTY_ROOM_GRACE_MS = 1500;

export class MinesweeperSession {
  private engine: MinesweeperEngine;
  private players: MinesweeperPlayer[] = [];
  private resultRecorded = false;
  private readonly onSessionEnded?: () => void;
  private readonly emptyRoomGraceMs: number;
  private emptyRoomTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private identity: MinesweeperSessionIdentity,
    private broadcaster: ActivityBroadcaster,
    private gamification: GamificationService = new GamificationService(),
    engineConfig: MinesweeperEngineConfig = {},
    options: MinesweeperSessionOptions = {},
  ) {
    this.engine = new MinesweeperEngine(engineConfig);
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
    return this.players.length;
  }

  private get roomKey(): string {
    return this.identity.sessionKey;
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

  // True when `connection` was the last socket holding the slot. A dropped
  // connection never forfeits or pauses anything here — the board and every
  // other player's ability to keep clicking is completely unaffected.
  removeConnection(userId: string, connection: unknown): void {
    const player = this.players.find((p) => p.userId === userId);
    if (!player) return;
    player.connections.delete(connection);
    if (player.connections.size > 0) return;
    this.players = this.players.filter((p) => p.userId !== userId);
    if (this.players.length === 0) {
      this.clearEmptyRoomTimer();
      this.emptyRoomTimer = setTimeout(() => {
        this.emptyRoomTimer = null;
        if (this.players.length === 0) this.onSessionEnded?.();
      }, this.emptyRoomGraceMs);
    }
  }

  getBoardSnapshot() {
    return {
      width: this.engine.getWidth(),
      height: this.engine.getHeight(),
      grid: this.engine.getPublicGrid(),
      scores: this.engine.getScores(),
      gameOver: this.engine.isGameOver(),
    };
  }

  reveal(userId: string, x: number, y: number) {
    if (!this.players.some((p) => p.userId === userId)) {
      return { error: 'not_in_session' as const };
    }

    const result = this.engine.reveal(userId, x, y);
    if ('error' in result) return result;

    this.broadcaster.broadcast(this.roomKey, {
      type: 'reveal',
      payload: {
        userId,
        revealedTiles: result.revealedTiles,
        pointsDelta: result.pointsDelta,
        hitMine: result.hitMine,
        gameOver: result.gameOver,
        scores: result.scores,
      },
    });

    if (result.gameOver && !this.resultRecorded) {
      this.resultRecorded = true;
      this.recordResult(result.scores);
      this.broadcaster.broadcast(this.roomKey, {
        type: 'game_over',
        payload: { scores: result.scores },
      });
    }

    return result;
  }

  private recordResult(scores: Record<string, number>) {
    if (this.players.length === 0) return;

    // Rank purely by score, highest first; ties share the same position so
    // neither gets a phantom edge over the other.
    const ranked = [...this.players]
      .map((player) => ({
        userId: player.userId,
        score: scores[player.userId] ?? 0,
      }))
      .sort((a, b) => b.score - a.score);

    const results = ranked.map((entry, index) => {
      const position =
        index === 0 || entry.score < ranked[index - 1]!.score
          ? index + 1
          : ranked.findIndex((r) => r.score === entry.score) + 1;
      return { userId: entry.userId, position };
    });

    this.gamification.recordGameResult({
      sessionId: this.identity.instanceId,
      guildId: this.identity.guildId,
      gameType: 'minesweeper-versus',
      results,
    });
  }

  // MANDATORY per §6.2: clears the empty-room grace timer so it can't fire
  // `onSessionEnded` into an already-disposed room.
  dispose(): void {
    this.clearEmptyRoomTimer();
  }
}
