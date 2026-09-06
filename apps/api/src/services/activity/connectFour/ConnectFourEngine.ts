export type Disc = 'p1' | 'p2';

export const ROWS = 6;
export const COLS = 7;

export interface ConnectFourState {
  grid: (Disc | null)[][];
  currentTurn: Disc;
  winner: Disc | null;
  winningLine: Array<{ row: number; col: number }> | null;
  isDraw: boolean;
}

export interface DropResult {
  row: number;
  col: number;
}

// Anchored at the just-placed disc, one direction pair at a time (up/down,
// left/right, both diagonals) — cheaper than rescanning the whole board
// after every move, and the only cells that can complete a new line are the
// ones reachable from the disc that just landed.
const DIRECTIONS: Array<[[number, number], [number, number]]> = [
  [
    [0, -1],
    [0, 1],
  ],
  [
    [-1, 0],
    [1, 0],
  ],
  [
    [-1, -1],
    [1, 1],
  ],
  [
    [-1, 1],
    [1, -1],
  ],
];

export class ConnectFourEngine {
  private readonly grid: (Disc | null)[][];
  private currentTurn: Disc = 'p1';
  private winner: Disc | null = null;
  private winningLine: Array<{ row: number; col: number }> | null = null;
  private moveCount = 0;

  constructor() {
    this.grid = Array.from({ length: ROWS }, () =>
      Array<Disc | null>(COLS).fill(null),
    );
  }

  getState(): ConnectFourState {
    return {
      grid: this.grid.map((row) => [...row]),
      currentTurn: this.currentTurn,
      winner: this.winner,
      winningLine: this.winningLine ? [...this.winningLine] : null,
      isDraw: !this.winner && this.moveCount === ROWS * COLS,
    };
  }

  private cellAt(row: number, col: number): Disc | null {
    return this.grid[row]![col]!;
  }

  private setCell(row: number, col: number, value: Disc | null) {
    this.grid[row]![col] = value;
  }

  isColumnFull(col: number): boolean {
    return this.cellAt(0, col) !== null;
  }

  // Highest row index (closest to the bottom) still empty in `col`, or null
  // when the column is full — this is where gravity settles the next disc.
  private lowestEmptyRow(col: number): number | null {
    for (let row = ROWS - 1; row >= 0; row--) {
      if (this.cellAt(row, col) === null) return row;
    }
    return null;
  }

  // Returns the drop result on success, or null if the move is illegal
  // (column out of range, full, wrong player's turn, or the game already
  // has a winner). Caller is responsible for surfacing why to the client.
  dropDisc(col: number, player: Disc): DropResult | null {
    if (this.winner) return null;
    if (!Number.isInteger(col) || col < 0 || col >= COLS) return null;
    if (player !== this.currentTurn) return null;

    const row = this.lowestEmptyRow(col);
    if (row === null) return null;

    this.setCell(row, col, player);
    this.moveCount += 1;

    const line = this.findWinningLine(row, col, player);
    if (line) {
      this.winner = player;
      this.winningLine = line;
    } else {
      this.currentTurn = player === 'p1' ? 'p2' : 'p1';
    }

    return { row, col };
  }

  private findWinningLine(
    row: number,
    col: number,
    player: Disc,
  ): Array<{ row: number; col: number }> | null {
    for (const [[dr1, dc1], [dr2, dc2]] of DIRECTIONS) {
      const line = [{ row, col }];
      this.collect(row, col, dr1, dc1, player, line);
      this.collect(row, col, dr2, dc2, player, line);
      if (line.length >= 4) return line;
    }
    return null;
  }

  private collect(
    row: number,
    col: number,
    dr: number,
    dc: number,
    player: Disc,
    line: Array<{ row: number; col: number }>,
  ) {
    let r = row + dr;
    let c = col + dc;
    while (
      r >= 0 &&
      r < ROWS &&
      c >= 0 &&
      c < COLS &&
      this.cellAt(r, c) === player
    ) {
      line.push({ row: r, col: c });
      r += dr;
      c += dc;
    }
  }

  // Used by the bot to look ahead one ply without mutating real state:
  // simulates dropping `player`'s disc in `col` and reports whether it
  // would win, without touching the engine's own grid/turn.
  wouldWin(col: number, player: Disc): boolean {
    if (this.isColumnFull(col)) return false;
    const row = this.lowestEmptyRow(col);
    if (row === null) return false;
    this.setCell(row, col, player);
    const line = this.findWinningLine(row, col, player);
    this.setCell(row, col, null);
    return line !== null;
  }

  validColumns(): number[] {
    const cols: number[] = [];
    for (let col = 0; col < COLS; col++) {
      if (!this.isColumnFull(col)) cols.push(col);
    }
    return cols;
  }

  forceWinner(player: Disc) {
    if (this.winner) return;
    this.winner = player;
  }
}
