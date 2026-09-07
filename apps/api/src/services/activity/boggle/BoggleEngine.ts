export const GRID_SIZE = 4;
export const GAME_DURATION_MS = 3 * 60_000;

export interface Cell {
  row: number;
  col: number;
}

export interface BoggleEngineOptions {
  wordSet: Set<string>;
  grid?: string[][];
  durationMs?: number;
  random?: () => number;
}

export interface PlayerState {
  userId: string;
  score: number;
  foundWords: { word: string; points: number }[];
}

export type SubmitRejectReason =
  | 'not_started'
  | 'already_ended'
  | 'unknown_player'
  | 'invalid_path'
  | 'too_short'
  | 'not_a_word'
  | 'already_found';

export type SubmitResult =
  | { accepted: true; word: string; points: number; totalScore: number }
  | { accepted: false; reason: SubmitRejectReason };

// Portuguese letter frequencies (approximate, per 100 letters), used to
// weight the random grid instead of hardcoding a fixed set of 16 dice like
// English Boggle does — the game's dictionary (see boggleWords.ts) is
// Portuguese, so an English dice set (heavy on Q/X/J-adjacent English
// digraphs) would produce grids that rarely spell real Portuguese words.
// K, W and Y are excluded as vanishingly rare outside loanwords. Grid
// letters are always plain, unaccented uppercase — matched against the
// diacritic-stripped dictionary in boggleWords.ts.
const LETTER_WEIGHTS: [string, number][] = [
  ['A', 14.63],
  ['E', 12.57],
  ['O', 10.73],
  ['S', 7.81],
  ['R', 6.53],
  ['I', 6.18],
  ['N', 5.05],
  ['D', 4.99],
  ['M', 4.74],
  ['U', 4.63],
  ['T', 4.34],
  ['C', 3.88],
  ['L', 2.78],
  ['P', 2.52],
  ['V', 1.67],
  ['G', 1.3],
  ['H', 1.28],
  ['Q', 1.2],
  ['B', 1.04],
  ['F', 1.02],
  ['Z', 0.47],
  ['J', 0.4],
  ['X', 0.21],
];

const TOTAL_WEIGHT = LETTER_WEIGHTS.reduce((sum, [, w]) => sum + w, 0);

function pickWeightedLetter(random: () => number): string {
  let target = random() * TOTAL_WEIGHT;
  for (const [letter, weight] of LETTER_WEIGHTS) {
    target -= weight;
    if (target <= 0) return letter;
  }
  return LETTER_WEIGHTS[LETTER_WEIGHTS.length - 1]![0];
}

export function generateGrid(random: () => number = Math.random): string[][] {
  const grid: string[][] = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    const line: string[] = [];
    for (let col = 0; col < GRID_SIZE; col++) {
      line.push(pickWeightedLetter(random));
    }
    grid.push(line);
  }
  return grid;
}

function inBounds(cell: Cell): boolean {
  return (
    Number.isInteger(cell.row) &&
    Number.isInteger(cell.col) &&
    cell.row >= 0 &&
    cell.row < GRID_SIZE &&
    cell.col >= 0 &&
    cell.col < GRID_SIZE
  );
}

function isAdjacent(a: Cell, b: Cell): boolean {
  const dr = Math.abs(a.row - b.row);
  const dc = Math.abs(a.col - b.col);
  return dr <= 1 && dc <= 1 && !(dr === 0 && dc === 0);
}

// Validates a candidate path is legal on the Boggle board: every cell is
// in bounds, no cell is reused, and each consecutive pair is adjacent
// (including diagonally). Does not check the spelled word against any
// dictionary — that's a separate concern in submitWord.
export function isValidPath(path: Cell[]): boolean {
  if (path.length === 0) return false;
  const seen = new Set<string>();
  for (let i = 0; i < path.length; i++) {
    const cell: Cell = path[i]!;
    if (!inBounds(cell)) return false;
    const key = `${cell.row},${cell.col}`;
    if (seen.has(key)) return false;
    seen.add(key);
    const prev: Cell | undefined = path[i - 1];
    if (i > 0 && prev && !isAdjacent(prev, cell)) return false;
  }
  return true;
}

export function extractWord(grid: string[][], path: Cell[]): string {
  return path.map((cell) => grid[cell.row]![cell.col]!).join('');
}

// Standard party-Boggle length scoring: 3-4 letters = 1pt, 5 = 2pt,
// 6 = 3pt, 7 = 5pt, 8+ = 11pt.
export function scoreForLength(length: number): number {
  if (length < 3) return 0;
  if (length <= 4) return 1;
  if (length === 5) return 2;
  if (length === 6) return 3;
  if (length === 7) return 5;
  return 11;
}

export class BoggleEngine {
  readonly grid: string[][];
  private wordSet: Set<string>;
  private readonly durationMs: number;
  private players = new Map<string, PlayerState>();
  private startedAt: number | null = null;
  private ended = false;

  constructor(options: BoggleEngineOptions) {
    this.wordSet = options.wordSet;
    this.durationMs = options.durationMs ?? GAME_DURATION_MS;
    this.grid = options.grid ?? generateGrid(options.random);
  }

  start(now: number = Date.now()): void {
    this.startedAt = now;
    this.ended = false;
  }

  end(): void {
    this.ended = true;
  }

  get isStarted(): boolean {
    return this.startedAt !== null;
  }

  get isEnded(): boolean {
    return this.ended;
  }

  timeRemainingMs(now: number = Date.now()): number {
    if (this.startedAt === null) return this.durationMs;
    const elapsed = now - this.startedAt;
    return Math.max(0, this.durationMs - elapsed);
  }

  isExpired(now: number = Date.now()): boolean {
    return this.isStarted && this.timeRemainingMs(now) <= 0;
  }

  addPlayer(userId: string): void {
    if (this.players.has(userId)) return;
    this.players.set(userId, { userId, score: 0, foundWords: [] });
  }

  getPlayer(userId: string): PlayerState | undefined {
    return this.players.get(userId);
  }

  // Everyone who finds a word scores it independently — this is the
  // simpler of the two standard party-Boggle rules (the alternative
  // cancels words found by more than one player). Chosen because it needs
  // no cross-player bookkeeping until the round ends and rewards fast,
  // independent play, which fits a timed "race" format better than
  // punishing players for finding the same obvious word as an opponent.
  submitWord(
    userId: string,
    path: Cell[],
    now: number = Date.now(),
  ): SubmitResult {
    if (!this.isStarted) return { accepted: false, reason: 'not_started' };
    if (this.ended || this.isExpired(now)) {
      this.ended = true;
      return { accepted: false, reason: 'already_ended' };
    }

    const player = this.players.get(userId);
    if (!player) return { accepted: false, reason: 'unknown_player' };

    if (!isValidPath(path)) {
      return { accepted: false, reason: 'invalid_path' };
    }

    const word = extractWord(this.grid, path).toLowerCase();
    if (word.length < 3) return { accepted: false, reason: 'too_short' };
    if (!this.wordSet.has(word))
      return { accepted: false, reason: 'not_a_word' };
    if (player.foundWords.some((f) => f.word === word)) {
      return { accepted: false, reason: 'already_found' };
    }

    const points = scoreForLength(word.length);
    player.foundWords.push({ word, points });
    player.score += points;

    return { accepted: true, word, points, totalScore: player.score };
  }

  getState(now: number = Date.now()) {
    return {
      grid: this.grid,
      timeRemainingMs: this.timeRemainingMs(now),
      ended: this.ended,
      players: Array.from(this.players.values()).map((p) => ({
        userId: p.userId,
        score: p.score,
        wordCount: p.foundWords.length,
      })),
    };
  }

  getFinalResults(): { userId: string; score: number; words: string[] }[] {
    return Array.from(this.players.values())
      .map((p) => ({
        userId: p.userId,
        score: p.score,
        words: p.foundWords.map((f) => f.word),
      }))
      .sort((a, b) => b.score - a.score);
  }
}
