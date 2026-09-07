import { SeededRng } from 'services/activity/cards/core/rng';

export const TOWER_LEVELS = 18;
export const BLOCKS_PER_LEVEL = 3;

// Mirrors real Jenga: the top two *completed* levels are what's currently
// resting on (and stabilizing) everything below, so they can't be pulled
// from — only once a level is buried under two full levels above it does it
// become fair game.
const PROTECTED_TOP_LEVELS = 2;

// Instability is a weighted sum of two independent pressures: a slow,
// tower-wide creep (more wood gone overall = more sway) and a sharp,
// per-level penalty that punishes gutting one level almost empty (a level
// missing 2 of its 3 blocks is far more likely to be the one that gives than
// a level missing 1) — hence the level term being squared rather than linear.
const BASE_INSTABILITY_WEIGHT = 0.4;
const LEVEL_INSTABILITY_WEIGHT = 0.6;
const MAX_INSTABILITY = 0.97;

export interface TowerLevelState {
  present: boolean[];
}

export interface TowerLastPull {
  level: number;
  position: number;
  instability: number;
  toppled: boolean;
  puller: string;
}

export interface TowerState {
  levels: TowerLevelState[];
  pendingBlocks: number;
  totalRemoved: number;
  totalBlocksOriginal: number;
  eligibleLevelCount: number;
  currentPlayer: string;
  turnOrder: string[];
  eliminated: string[];
  status: 'playing' | 'ended';
  winner: string | null;
  lastPull: TowerLastPull | null;
}

export interface PullResult {
  success: boolean;
  error?: string;
  toppled?: boolean;
  instability?: number;
}

interface Level {
  blocks: boolean[];
}

export class TowerEngine {
  private levels: Level[];
  private pendingBlocks = 0;
  private totalRemoved = 0;
  private rng: SeededRng;
  private readonly players: string[];
  private currentIndex = 0;
  private eliminated = new Set<string>();
  private status: 'playing' | 'ended' = 'playing';
  private winner: string | null = null;
  private lastPull: TowerLastPull | null = null;
  private readonly totalBlocksOriginal: number;

  constructor(
    players: string[],
    seed: number,
    private levelCount = TOWER_LEVELS,
    private blocksPerLevel = BLOCKS_PER_LEVEL,
  ) {
    if (players.length < 2) {
      throw new Error('Tower requires at least 2 players');
    }
    this.players = [...players];
    this.rng = new SeededRng(seed);
    this.totalBlocksOriginal = levelCount * blocksPerLevel;
    this.levels = Array.from({ length: levelCount }, () => ({
      blocks: Array.from({ length: blocksPerLevel }, () => true),
    }));
  }

  getState(): TowerState {
    return {
      levels: this.levels.map((level) => ({ present: [...level.blocks] })),
      pendingBlocks: this.pendingBlocks,
      totalRemoved: this.totalRemoved,
      totalBlocksOriginal: this.totalBlocksOriginal,
      eligibleLevelCount: this.eligibleLevelCount(),
      currentPlayer: this.players[this.currentIndex]!,
      turnOrder: [...this.players],
      eliminated: [...this.eliminated],
      status: this.status,
      winner: this.winner,
      lastPull: this.lastPull ? { ...this.lastPull } : null,
    };
  }

  pull(userId: string, level: number, position: number): PullResult {
    if (this.status !== 'playing') {
      return { success: false, error: 'Game is already over' };
    }
    if (userId !== this.players[this.currentIndex]) {
      return { success: false, error: `It's not ${userId}'s turn` };
    }
    if (level < 0 || level >= this.levels.length) {
      return { success: false, error: 'Invalid level' };
    }
    if (position < 0 || position >= this.blocksPerLevel) {
      return { success: false, error: 'Invalid position' };
    }
    if (!this.isEligibleLevel(level)) {
      return {
        success: false,
        error: 'Cannot pull from the top protected levels',
      };
    }
    if (!this.levels[level]!.blocks[position]) {
      return { success: false, error: 'Block already removed' };
    }

    this.levels[level]!.blocks[position] = false;
    this.totalRemoved += 1;

    const missingFromLevel = this.levels[level]!.blocks.filter(
      (present) => !present,
    ).length;
    const instability = this.computeInstability(
      missingFromLevel,
      this.totalRemoved,
    );
    const toppled = this.rng.next() < instability;

    this.lastPull = { level, position, instability, toppled, puller: userId };

    if (toppled) {
      this.eliminatePlayer(userId);
    } else {
      this.stackBlock();
      this.advanceTurn();
    }

    return { success: true, toppled, instability };
  }

  private computeInstability(
    missingFromLevel: number,
    pullNumber: number,
  ): number {
    const baseFactor = Math.min(pullNumber / this.totalBlocksOriginal, 1);
    const levelRatio = missingFromLevel / this.blocksPerLevel;
    const levelFactor = levelRatio * levelRatio;
    const raw =
      BASE_INSTABILITY_WEIGHT * baseFactor +
      LEVEL_INSTABILITY_WEIGHT * levelFactor;
    return Math.min(raw, MAX_INSTABILITY);
  }

  private isEligibleLevel(level: number): boolean {
    return level < this.levels.length - PROTECTED_TOP_LEVELS;
  }

  private eligibleLevelCount(): number {
    return Math.max(this.levels.length - PROTECTED_TOP_LEVELS, 0);
  }

  private stackBlock() {
    this.pendingBlocks += 1;
    if (this.pendingBlocks === this.blocksPerLevel) {
      this.levels.push({
        blocks: Array.from({ length: this.blocksPerLevel }, () => true),
      });
      this.pendingBlocks = 0;
    }
  }

  // Elimination model: the player whose pull topples the tower is eliminated.
  // With exactly 2 players that immediately ends the match (the puller loses,
  // the other wins). With more, play continues among whoever is left until
  // one player remains — that survivor is the winner.
  private eliminatePlayer(userId: string) {
    this.eliminated.add(userId);
    const remaining = this.players.filter((p) => !this.eliminated.has(p));
    if (remaining.length <= 1) {
      this.status = 'ended';
      this.winner = remaining[0] ?? null;
      return;
    }
    this.advanceTurn();
  }

  private advanceTurn() {
    if (this.status === 'ended') return;
    let next = this.currentIndex;
    for (let i = 0; i < this.players.length; i++) {
      next = (next + 1) % this.players.length;
      if (!this.eliminated.has(this.players[next]!)) {
        this.currentIndex = next;
        return;
      }
    }
  }

  // Used only for forfeits (a disconnected player is treated as eliminated
  // without them ever having pulled a block).
  forceEliminate(userId: string) {
    if (this.status !== 'playing') return;
    if (!this.players.includes(userId)) return;
    if (this.eliminated.has(userId)) return;
    const wasCurrent = this.players[this.currentIndex] === userId;
    this.eliminated.add(userId);
    const remaining = this.players.filter((p) => !this.eliminated.has(p));
    if (remaining.length <= 1) {
      this.status = 'ended';
      this.winner = remaining[0] ?? null;
      return;
    }
    if (wasCurrent) this.advanceTurn();
  }
}
