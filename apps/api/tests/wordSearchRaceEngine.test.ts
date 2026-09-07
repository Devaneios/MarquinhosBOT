import { describe, expect, it } from 'bun:test';
import { WordSearchRaceEngine } from 'services/activity/word-search-race/WordSearchRaceEngine';

const TEST_WORDS = ['ROBO', 'PIXEL', 'ARCADE', 'CODIGO'];

function lettersOnLine(
  grid: string[][],
  start: { row: number; col: number },
  end: { row: number; col: number },
): string {
  const dr = Math.sign(end.row - start.row);
  const dc = Math.sign(end.col - start.col);
  const steps = Math.max(
    Math.abs(end.row - start.row),
    Math.abs(end.col - start.col),
  );
  let letters = '';
  for (let i = 0; i <= steps; i++) {
    letters += grid[start.row + dr * i]![start.col + dc * i];
  }
  return letters;
}

function findWordOnGrid(
  grid: string[][],
  word: string,
): { start: { row: number; col: number }; end: { row: number; col: number } } {
  const size = grid.length;
  const directions = [
    { row: -1, col: -1 },
    { row: -1, col: 0 },
    { row: -1, col: 1 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
    { row: 1, col: -1 },
    { row: 1, col: 0 },
    { row: 1, col: 1 },
  ];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      for (const dir of directions) {
        const end = {
          row: row + dir.row * (word.length - 1),
          col: col + dir.col * (word.length - 1),
        };
        if (end.row < 0 || end.row >= size || end.col < 0 || end.col >= size) {
          continue;
        }
        const letters = lettersOnLine(grid, { row, col }, end);
        if (letters === word) return { start: { row, col }, end };
      }
    }
  }
  throw new Error(`word ${word} not found on grid`);
}

describe('WordSearchRaceEngine', () => {
  it('generates a grid of the requested size filled with letters', () => {
    const engine = new WordSearchRaceEngine({ size: 10, words: TEST_WORDS });
    const grid = engine.getGrid();

    expect(grid.length).toBe(10);
    for (const row of grid) {
      expect(row.length).toBe(10);
      for (const cell of row) {
        expect(cell).toMatch(/^[A-Z]$/);
      }
    }
  });

  it('places every target word findable somewhere on the grid', () => {
    const engine = new WordSearchRaceEngine({ size: 12, words: TEST_WORDS });
    const grid = engine.getGrid();

    for (const word of TEST_WORDS) {
      expect(() => findWordOnGrid(grid, word)).not.toThrow();
    }
  });

  it('exposes the target word list unchanged', () => {
    const engine = new WordSearchRaceEngine({ size: 12, words: TEST_WORDS });
    expect(engine.getWords()).toEqual(TEST_WORDS);
  });

  it('picks a random word set of the default size when none is given', () => {
    const engine = new WordSearchRaceEngine();
    expect(engine.getWords().length).toBe(8);
    expect(engine.getSize()).toBe(12);
  });

  it('accepts a correct selection in the forward direction and marks it found', () => {
    const engine = new WordSearchRaceEngine({ size: 12, words: TEST_WORDS });
    const grid = engine.getGrid();
    const { start, end } = findWordOnGrid(grid, 'ROBO');

    const result = engine.submitSelection('user-a', start, end);

    expect(result).toEqual({ word: 'ROBO', userId: 'user-a', start, end });
    expect(engine.getScores()).toEqual({ 'user-a': 1 });
  });

  it('accepts a correct selection given in the reverse direction', () => {
    const engine = new WordSearchRaceEngine({ size: 12, words: TEST_WORDS });
    const grid = engine.getGrid();
    const { start, end } = findWordOnGrid(grid, 'ROBO');

    const result = engine.submitSelection('user-a', end, start);

    expect('error' in (result as object)).toBe(false);
    expect((result as { word: string }).word).toBe('ROBO');
  });

  it('rejects a selection that is not a straight line', () => {
    const engine = new WordSearchRaceEngine({ size: 12, words: TEST_WORDS });

    const result = engine.submitSelection(
      'user-a',
      { row: 0, col: 0 },
      { row: 3, col: 5 },
    );

    expect(result).toEqual({ error: 'Selection must be a straight line' });
  });

  it('rejects a selection that spans a single cell', () => {
    const engine = new WordSearchRaceEngine({ size: 12, words: TEST_WORDS });

    const result = engine.submitSelection(
      'user-a',
      { row: 2, col: 2 },
      { row: 2, col: 2 },
    );

    expect(result).toEqual({
      error: 'Selection must span at least two cells',
    });
  });

  it('rejects a selection that goes out of bounds', () => {
    const engine = new WordSearchRaceEngine({ size: 12, words: TEST_WORDS });

    const result = engine.submitSelection(
      'user-a',
      { row: 0, col: 0 },
      { row: -1, col: 0 },
    );

    expect(result).toEqual({ error: 'Selection out of bounds' });
  });

  it('rejects a selection whose letters spell no remaining word', () => {
    const engine = new WordSearchRaceEngine({ size: 12, words: TEST_WORDS });

    const result = engine.submitSelection(
      'user-a',
      { row: 0, col: 0 },
      { row: 0, col: 3 },
    );

    if (!('error' in (result as object))) {
      throw new Error('expected a random 4-letter run to not match a word');
    }
  });

  it('cannot find the same word twice', () => {
    const engine = new WordSearchRaceEngine({ size: 12, words: TEST_WORDS });
    const grid = engine.getGrid();
    const { start, end } = findWordOnGrid(grid, 'ROBO');

    engine.submitSelection('user-a', start, end);
    const second = engine.submitSelection('user-b', start, end);

    expect(second).toEqual({ error: 'No matching word in that selection' });
    expect(engine.getScores()).toEqual({ 'user-a': 1 });
  });

  it('tracks per-player scores across multiple finds', () => {
    const engine = new WordSearchRaceEngine({ size: 12, words: TEST_WORDS });
    const grid = engine.getGrid();

    const robo = findWordOnGrid(grid, 'ROBO');
    const pixel = findWordOnGrid(grid, 'PIXEL');

    engine.submitSelection('user-a', robo.start, robo.end);
    engine.submitSelection('user-b', pixel.start, pixel.end);

    expect(engine.getScores()).toEqual({ 'user-a': 1, 'user-b': 1 });
  });

  it('is complete once every target word has been found', () => {
    const engine = new WordSearchRaceEngine({ size: 12, words: TEST_WORDS });
    const grid = engine.getGrid();

    expect(engine.isComplete()).toBe(false);

    for (const word of TEST_WORDS) {
      const { start, end } = findWordOnGrid(grid, word);
      engine.submitSelection('user-a', start, end);
    }

    expect(engine.isComplete()).toBe(true);
  });

  it('reliably generates grids for a large default-sized word set without throwing', () => {
    for (let i = 0; i < 20; i++) {
      expect(() => new WordSearchRaceEngine()).not.toThrow();
    }
  });
});
