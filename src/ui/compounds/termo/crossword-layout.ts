import type { LetterFeedback } from './letter-states';
import type { TermoGuess } from './types';

export type Direction = 'h' | 'v';

export type GridCell = { letter: string; feedback: LetterFeedback };
export type Grid = Map<string, GridCell>;

export type PlacedWord = {
  word: string;
  feedback: LetterFeedback[];
  row: number;
  col: number;
  dir: Direction;
  isAnswer: boolean;
};

export type CrosswordLayout = {
  grid: Grid;
  placed: PlacedWord[];
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
};

type Candidate = {
  row: number;
  col: number;
  dir: Direction;
  intersectionIdx: number;
  connectsToAnswer: boolean;
};

function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

function delta(dir: Direction): [number, number] {
  return dir === 'h' ? [0, 1] : [1, 0];
}

function placeWord(grid: Grid, word: PlacedWord): void {
  const [dr, dc] = delta(word.dir);
  for (let i = 0; i < word.word.length; i++) {
    const k = cellKey(word.row + dr * i, word.col + dc * i);
    if (!grid.has(k)) {
      grid.set(k, { letter: word.word[i], feedback: word.feedback[i] });
    }
  }
}

function isValidPlacement(
  grid: Grid,
  word: string,
  row: number,
  col: number,
  dir: Direction,
  intersectionIdx: number,
): boolean {
  const [dr, dc] = delta(dir);

  if (grid.has(cellKey(row - dr, col - dc))) return false;
  if (grid.has(cellKey(row + dr * word.length, col + dc * word.length)))
    return false;

  for (let i = 0; i < word.length; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    const k = cellKey(r, c);

    if (i === intersectionIdx) {
      const existing = grid.get(k);
      if (!existing || existing.letter !== word[i]) return false;
    } else {
      if (grid.has(k)) return false;
    }
  }

  return true;
}

function findCandidates(
  grid: Grid,
  placed: PlacedWord[],
  guess: TermoGuess,
): Candidate[] {
  const candidates: Candidate[] = [];

  for (const placedWord of placed) {
    const newDir: Direction = placedWord.dir === 'h' ? 'v' : 'h';
    const [dr, dc] = delta(placedWord.dir);
    const [ndr, ndc] = delta(newDir);

    for (let j = 0; j < placedWord.word.length; j++) {
      const cellRow = placedWord.row + dr * j;
      const cellCol = placedWord.col + dc * j;

      for (let i = 0; i < guess.guess.length; i++) {
        if (guess.guess[i] !== placedWord.word[j]) continue;

        const startRow = cellRow - ndr * i;
        const startCol = cellCol - ndc * i;

        if (
          isValidPlacement(grid, guess.guess, startRow, startCol, newDir, i)
        ) {
          candidates.push({
            row: startRow,
            col: startCol,
            dir: newDir,
            intersectionIdx: i,
            connectsToAnswer: placedWord.isAnswer,
          });
        }
      }
    }
  }

  return candidates;
}

function scoreCandidate(
  candidate: Candidate,
  wordLength: number,
  bounds: { minRow: number; maxRow: number; minCol: number; maxCol: number },
): number {
  let score = 0;

  if (candidate.connectsToAnswer) score += 100;

  const midIdx = Math.floor(wordLength / 2);
  score -= Math.abs(candidate.intersectionIdx - midIdx) * 2;

  const [dr, dc] = delta(candidate.dir);
  const endRow = candidate.row + dr * (wordLength - 1);
  const endCol = candidate.col + dc * (wordLength - 1);

  const newMinRow = Math.min(bounds.minRow, candidate.row, endRow);
  const newMaxRow = Math.max(bounds.maxRow, candidate.row, endRow);
  const newMinCol = Math.min(bounds.minCol, candidate.col, endCol);
  const newMaxCol = Math.max(bounds.maxCol, candidate.col, endCol);

  const expansion =
    newMaxRow -
    newMinRow +
    newMaxCol -
    newMinCol -
    (bounds.maxRow - bounds.minRow) -
    (bounds.maxCol - bounds.minCol);
  score -= expansion;

  return score;
}

export function buildCrosswordLayout(
  answerWord: string,
  guesses: TermoGuess[],
): CrosswordLayout {
  const grid: Grid = new Map();
  const placed: PlacedWord[] = [];

  const answerFeedback = Array<LetterFeedback>(answerWord.length).fill(
    'correct',
  );
  const answerPlaced: PlacedWord = {
    word: answerWord,
    feedback: answerFeedback,
    row: 0,
    col: 0,
    dir: 'h',
    isAnswer: true,
  };
  placeWord(grid, answerPlaced);
  placed.push(answerPlaced);

  let bounds = {
    minRow: 0,
    maxRow: 0,
    minCol: 0,
    maxCol: answerWord.length - 1,
  };

  const unplaced = guesses.filter((g) => g.guess !== answerWord);

  while (unplaced.length > 0) {
    // MRV: sort by number of valid placements ascending (most constrained first)
    const ranked = unplaced
      .map((guess, gi) => ({
        gi,
        guess,
        candidates: findCandidates(grid, placed, guess),
      }))
      .filter((o) => o.candidates.length > 0)
      .sort((a, b) => a.candidates.length - b.candidates.length);

    if (ranked.length === 0) break;

    const { gi, guess, candidates } = ranked[0];
    const bestCandidate = candidates.reduce((best, c) =>
      scoreCandidate(c, guess.guess.length, bounds) >
      scoreCandidate(best, guess.guess.length, bounds)
        ? c
        : best,
    );

    const wordPlaced: PlacedWord = {
      word: guess.guess,
      feedback: guess.feedback,
      row: bestCandidate.row,
      col: bestCandidate.col,
      dir: bestCandidate.dir,
      isAnswer: false,
    };
    placeWord(grid, wordPlaced);
    placed.push(wordPlaced);
    unplaced.splice(gi, 1);

    const [dr, dc] = delta(bestCandidate.dir);
    const endRow = bestCandidate.row + dr * (guess.guess.length - 1);
    const endCol = bestCandidate.col + dc * (guess.guess.length - 1);
    bounds = {
      minRow: Math.min(bounds.minRow, bestCandidate.row, endRow),
      maxRow: Math.max(bounds.maxRow, bestCandidate.row, endRow),
      minCol: Math.min(bounds.minCol, bestCandidate.col, endCol),
      maxCol: Math.max(bounds.maxCol, bestCandidate.col, endCol),
    };
  }

  return { grid, placed, ...bounds };
}
