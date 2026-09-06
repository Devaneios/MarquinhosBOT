export interface MinesweeperEngineConfig {
  width?: number;
  height?: number;
  mineCount?: number;
}

interface Cell {
  mine: boolean;
  adjacent: number;
  revealed: boolean;
  revealedBy: string | null;
}

export interface PublicCell {
  revealed: boolean;
  mine?: boolean;
  adjacent?: number;
  revealedBy?: string | null;
}

export interface RevealedTile {
  x: number;
  y: number;
  mine: boolean;
  adjacent: number;
  revealedBy: string;
}

export type RevealResult =
  | { error: 'out_of_bounds' | 'already_revealed' | 'game_over' }
  | {
      revealedTiles: RevealedTile[];
      pointsDelta: number;
      hitMine: boolean;
      gameOver: boolean;
      scores: Record<string, number>;
    };

// -5 for a mine, +1 per safe tile a cascade uncovers — flat per-tile scoring
// keeps the flood-fill payout simple to reason about (and to test) instead
// of weighting by adjacent-mine count.
const MINE_PENALTY = -5;
const SAFE_TILE_POINTS = 1;

const NEIGHBOR_OFFSETS: [number, number][] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

export class MinesweeperEngine {
  private readonly width: number;
  private readonly height: number;
  private readonly mineCount: number;
  private readonly grid: Cell[][];
  private scores = new Map<string, number>();
  private safeTilesRemaining: number;
  private gameOver = false;

  constructor(config: MinesweeperEngineConfig = {}) {
    this.width = config.width ?? 16;
    this.height = config.height ?? 16;
    this.mineCount = config.mineCount ?? 40;
    this.grid = this.buildGrid();
    this.safeTilesRemaining = this.width * this.height - this.mineCount;
  }

  private buildGrid(): Cell[][] {
    const cells: Cell[][] = Array.from({ length: this.height }, () =>
      Array.from({ length: this.width }, () => ({
        mine: false,
        adjacent: 0,
        revealed: false,
        revealedBy: null,
      })),
    );

    // Mine layout is generated once here, at construction, and never
    // touched again — the brief calls for a single shared minefield fixed
    // at game start rather than a first-click-safe layout.
    let placed = 0;
    while (placed < this.mineCount) {
      const x = Math.floor(Math.random() * this.width);
      const y = Math.floor(Math.random() * this.height);
      if (cells[y]![x]!.mine) continue;
      cells[y]![x]!.mine = true;
      placed += 1;
    }

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (cells[y]![x]!.mine) continue;
        cells[y]![x]!.adjacent = this.countAdjacentMines(cells, x, y);
      }
    }

    return cells;
  }

  private countAdjacentMines(cells: Cell[][], x: number, y: number): number {
    let count = 0;
    for (const [dx, dy] of NEIGHBOR_OFFSETS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!this.inBounds(nx, ny)) continue;
      if (cells[ny]![nx]!.mine) count += 1;
    }
    return count;
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  // Every call site has already bounds-checked (x, y) via inBounds(), so the
  // possible-undefined from noUncheckedIndexedAccess is a false positive —
  // centralized here instead of a `!` at every grid[y][x] call site.
  private cellAt(x: number, y: number): Cell {
    return this.grid[y]![x]!;
  }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }

  isGameOver(): boolean {
    return this.gameOver;
  }

  getScores(): Record<string, number> {
    return Object.fromEntries(this.scores);
  }

  private addScore(userId: string, delta: number): void {
    this.scores.set(userId, (this.scores.get(userId) ?? 0) + delta);
  }

  // Never exposes `mine` for a tile that isn't revealed — this is the one
  // function allowed to touch `cell.mine` for output, and it only does so
  // behind `cell.revealed`.
  getPublicGrid(): PublicCell[][] {
    return this.grid.map((row) =>
      row.map((cell): PublicCell =>
        cell.revealed
          ? {
              revealed: true,
              mine: cell.mine,
              adjacent: cell.adjacent,
              revealedBy: cell.revealedBy,
            }
          : { revealed: false },
      ),
    );
  }

  reveal(userId: string, x: number, y: number): RevealResult {
    if (this.gameOver) return { error: 'game_over' };
    if (!this.inBounds(x, y)) return { error: 'out_of_bounds' };
    if (this.cellAt(x, y).revealed) return { error: 'already_revealed' };

    const cell = this.cellAt(x, y);
    if (cell.mine) {
      cell.revealed = true;
      cell.revealedBy = userId;
      this.addScore(userId, MINE_PENALTY);
      // A revealed mine doesn't shrink safeTilesRemaining and can't end the
      // game on its own — the match only ends once every safe tile is clear.
      return {
        revealedTiles: [{ x, y, mine: true, adjacent: 0, revealedBy: userId }],
        pointsDelta: MINE_PENALTY,
        hitMine: true,
        gameOver: this.gameOver,
        scores: this.getScores(),
      };
    }

    const cascade = this.floodFill(x, y, userId);
    const pointsDelta = cascade.length * SAFE_TILE_POINTS;
    this.addScore(userId, pointsDelta);
    this.safeTilesRemaining -= cascade.length;
    if (this.safeTilesRemaining <= 0) this.gameOver = true;

    return {
      revealedTiles: cascade,
      pointsDelta,
      hitMine: false,
      gameOver: this.gameOver,
      scores: this.getScores(),
    };
  }

  // Standard minesweeper cascade: reveal the clicked tile, and if it has no
  // adjacent mines, keep expanding to every connected zero-adjacent tile
  // plus the ring of numbered tiles bordering that region. Every tile the
  // cascade touches is credited to the same `userId` who triggered it.
  private floodFill(
    startX: number,
    startY: number,
    userId: string,
  ): RevealedTile[] {
    const revealed: RevealedTile[] = [];
    const queue: [number, number][] = [[startX, startY]];
    const seen = new Set<string>([`${startX},${startY}`]);

    while (queue.length > 0) {
      const [x, y] = queue.shift()!;
      const cell = this.cellAt(x, y);
      cell.revealed = true;
      cell.revealedBy = userId;
      revealed.push({
        x,
        y,
        mine: false,
        adjacent: cell.adjacent,
        revealedBy: userId,
      });

      if (cell.adjacent !== 0) continue;

      for (const [dx, dy] of NEIGHBOR_OFFSETS) {
        const nx = x + dx;
        const ny = y + dy;
        if (!this.inBounds(nx, ny)) continue;
        const key = `${nx},${ny}`;
        if (seen.has(key)) continue;
        const neighbor = this.cellAt(nx, ny);
        if (neighbor.revealed || neighbor.mine) continue;
        seen.add(key);
        queue.push([nx, ny]);
      }
    }

    return revealed;
  }
}
