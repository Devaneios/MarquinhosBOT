export interface Cell {
  row: number;
  col: number;
}

export interface FoundWord {
  word: string;
  userId: string;
  start: Cell;
  end: Cell;
}

export interface WordSearchRaceEngineConfig {
  size?: number;
  words?: string[];
}

export type SelectionResult = FoundWord | { error: string };

const DEFAULT_SIZE = 12;
const DEFAULT_WORD_COUNT = 8;
const MAX_PLACEMENT_ATTEMPTS_PER_WORD = 200;
const MAX_GRID_ATTEMPTS = 100;

const DEFAULT_WORD_BANK = [
  'ROBO',
  'PIXEL',
  'ARCADE',
  'JOGO',
  'CODIGO',
  'SERVIDOR',
  'TECLADO',
  'MOUSE',
  'MONITOR',
  'FONE',
  'MOEDA',
  'ESCUDO',
  'ESPADA',
  'CASTELO',
  'FLORESTA',
  'MONSTRO',
  'HEROI',
  'TESOURO',
  'MAGIA',
  'PORTAL',
  'LABIRINTO',
  'DRAGAO',
  'BATALHA',
  'MISSAO',
];

const DIRECTIONS: Cell[] = [
  { row: -1, col: -1 },
  { row: -1, col: 0 },
  { row: -1, col: 1 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
  { row: 1, col: -1 },
  { row: 1, col: 0 },
  { row: 1, col: 1 },
];

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function pickRandomWords(bank: string[], count: number): string[] {
  const pool = [...bank];
  const picked: string[] = [];
  while (picked.length < count && pool.length > 0) {
    const index = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(index, 1)[0]!);
  }
  return picked;
}

export class WordSearchRaceEngine {
  private readonly size: number;
  private readonly words: string[];
  private readonly grid: string[][];
  private remaining: Set<string>;
  private found: FoundWord[] = [];
  private scores = new Map<string, number>();

  constructor(config: WordSearchRaceEngineConfig = {}) {
    this.size = config.size ?? DEFAULT_SIZE;
    this.words = (
      config.words ?? pickRandomWords(DEFAULT_WORD_BANK, DEFAULT_WORD_COUNT)
    ).map((w) => w.toUpperCase());
    this.remaining = new Set(this.words);
    this.grid = this.generateGrid();
  }

  private generateGrid(): string[][] {
    for (let attempt = 0; attempt < MAX_GRID_ATTEMPTS; attempt++) {
      const grid = this.tryBuildGrid();
      if (grid) return grid;
    }
    throw new Error(
      'Failed to generate word search grid: words do not fit the given size',
    );
  }

  // Places longest words first (they have the fewest valid spots), then
  // backfills every untouched cell with a random letter. Returns null to
  // signal "start over with a fresh random layout" rather than partially
  // placing a word — a half-placed word would let a player "find" a target
  // that isn't actually fully on the grid.
  private tryBuildGrid(): string[][] | null {
    const cells: (string | null)[][] = Array.from({ length: this.size }, () =>
      Array<string | null>(this.size).fill(null),
    );
    const ordered = [...this.words].sort((a, b) => b.length - a.length);

    for (const word of ordered) {
      if (!this.placeWord(cells, word)) return null;
    }

    return cells.map((row) =>
      row.map((cell) => cell ?? ALPHABET[Math.floor(Math.random() * 26)]!),
    );
  }

  private placeWord(cells: (string | null)[][], word: string): boolean {
    for (
      let attempt = 0;
      attempt < MAX_PLACEMENT_ATTEMPTS_PER_WORD;
      attempt++
    ) {
      const direction =
        DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)]!;
      const endRow = direction.row * (word.length - 1);
      const endCol = direction.col * (word.length - 1);

      const minRow = Math.max(0, -endRow);
      const maxRow = Math.min(this.size - 1, this.size - 1 - endRow);
      const minCol = Math.max(0, -endCol);
      const maxCol = Math.min(this.size - 1, this.size - 1 - endCol);
      if (minRow > maxRow || minCol > maxCol) continue;

      const startRow =
        minRow + Math.floor(Math.random() * (maxRow - minRow + 1));
      const startCol =
        minCol + Math.floor(Math.random() * (maxCol - minCol + 1));

      if (this.fits(cells, word, startRow, startCol, direction)) {
        this.write(cells, word, startRow, startCol, direction);
        return true;
      }
    }
    return false;
  }

  private fits(
    cells: (string | null)[][],
    word: string,
    startRow: number,
    startCol: number,
    direction: Cell,
  ): boolean {
    for (let i = 0; i < word.length; i++) {
      const row = startRow + direction.row * i;
      const col = startCol + direction.col * i;
      const existing = cells[row]![col];
      if (existing !== null && existing !== word[i]) return false;
    }
    return true;
  }

  private write(
    cells: (string | null)[][],
    word: string,
    startRow: number,
    startCol: number,
    direction: Cell,
  ): void {
    for (let i = 0; i < word.length; i++) {
      const row = startRow + direction.row * i;
      const col = startCol + direction.col * i;
      cells[row]![col] = word[i]!;
    }
  }

  getSize(): number {
    return this.size;
  }

  getGrid(): string[][] {
    return this.grid.map((row) => [...row]);
  }

  getWords(): string[] {
    return [...this.words];
  }

  getFound(): FoundWord[] {
    return this.found.map((f) => ({
      ...f,
      start: { ...f.start },
      end: { ...f.end },
    }));
  }

  getScores(): Record<string, number> {
    return Object.fromEntries(this.scores);
  }

  isComplete(): boolean {
    return this.remaining.size === 0;
  }

  private inBounds(cell: Cell): boolean {
    return (
      cell.row >= 0 &&
      cell.row < this.size &&
      cell.col >= 0 &&
      cell.col < this.size
    );
  }

  submitSelection(userId: string, start: Cell, end: Cell): SelectionResult {
    if (!this.inBounds(start) || !this.inBounds(end)) {
      return { error: 'Selection out of bounds' };
    }

    const dr = end.row - start.row;
    const dc = end.col - start.col;
    if (dr === 0 && dc === 0) {
      return { error: 'Selection must span at least two cells' };
    }
    if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) {
      return { error: 'Selection must be a straight line' };
    }

    const steps = Math.max(Math.abs(dr), Math.abs(dc));
    const stepRow = Math.sign(dr);
    const stepCol = Math.sign(dc);

    let letters = '';
    for (let i = 0; i <= steps; i++) {
      letters += this.grid[start.row + stepRow * i]![start.col + stepCol * i];
    }

    const reversed = letters.split('').reverse().join('');
    const match = this.remaining.has(letters)
      ? letters
      : this.remaining.has(reversed)
        ? reversed
        : null;

    if (!match) {
      return { error: 'No matching word in that selection' };
    }

    this.remaining.delete(match);
    const foundWord: FoundWord = { word: match, userId, start, end };
    this.found.push(foundWord);
    this.scores.set(userId, (this.scores.get(userId) ?? 0) + 1);

    return foundWord;
  }
}
