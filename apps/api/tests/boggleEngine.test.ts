import { describe, expect, it } from 'bun:test';
import {
  BoggleEngine,
  extractWord,
  generateGrid,
  isValidPath,
  scoreForLength,
  type Cell,
} from 'services/activity/boggle/BoggleEngine';

const GRID = [
  ['C', 'A', 'T', 'S'],
  ['O', 'R', 'E', 'N'],
  ['D', 'O', 'G', 'S'],
  ['A', 'B', 'C', 'D'],
];

function makeEngine(
  overrides: Partial<{ wordSet: Set<string>; durationMs: number }> = {},
) {
  return new BoggleEngine({
    wordSet:
      overrides.wordSet ?? new Set(['cat', 'car', 'care', 'dog', 'cats']),
    grid: GRID,
    durationMs: overrides.durationMs,
  });
}

describe('generateGrid', () => {
  it('produces a 4x4 grid of single uppercase letters', () => {
    const grid = generateGrid(() => 0.5);
    expect(grid.length).toBe(4);
    for (const row of grid) {
      expect(row.length).toBe(4);
      for (const letter of row) {
        expect(letter).toMatch(/^[A-Z]$/);
      }
    }
  });

  it('is deterministic for a fixed random source', () => {
    const gridA = generateGrid(() => 0.1);
    const gridB = generateGrid(() => 0.1);
    expect(gridA).toEqual(gridB);
  });
});

describe('isValidPath', () => {
  it('accepts a straight horizontal path', () => {
    const path: Cell[] = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ];
    expect(isValidPath(path)).toBe(true);
  });

  it('accepts a diagonal path', () => {
    const path: Cell[] = [
      { row: 0, col: 0 },
      { row: 1, col: 1 },
      { row: 2, col: 2 },
    ];
    expect(isValidPath(path)).toBe(true);
  });

  it('rejects a path with a non-adjacent jump', () => {
    const path: Cell[] = [
      { row: 0, col: 0 },
      { row: 0, col: 2 },
    ];
    expect(isValidPath(path)).toBe(false);
  });

  it('rejects a path that reuses a cell', () => {
    const path: Cell[] = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 0 },
    ];
    expect(isValidPath(path)).toBe(false);
  });

  it('rejects a path with an out-of-bounds cell', () => {
    const path: Cell[] = [
      { row: 0, col: 0 },
      { row: -1, col: 0 },
    ];
    expect(isValidPath(path)).toBe(false);
  });

  it('rejects an empty path', () => {
    expect(isValidPath([])).toBe(false);
  });

  it('accepts a single-cell path', () => {
    expect(isValidPath([{ row: 1, col: 1 }])).toBe(true);
  });
});

describe('extractWord', () => {
  it('spells out the letters along the path in order', () => {
    const path: Cell[] = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ];
    expect(extractWord(GRID, path)).toBe('CAT');
  });

  it('follows a diagonal path correctly', () => {
    // C(0,0) -> R(1,1) -> G(2,2)
    const path: Cell[] = [
      { row: 0, col: 0 },
      { row: 1, col: 1 },
      { row: 2, col: 2 },
    ];
    expect(extractWord(GRID, path)).toBe('CRG');
  });
});

describe('scoreForLength', () => {
  it('scores 3-4 letter words as 1 point', () => {
    expect(scoreForLength(3)).toBe(1);
    expect(scoreForLength(4)).toBe(1);
  });
  it('scores 5 letters as 2 points', () => {
    expect(scoreForLength(5)).toBe(2);
  });
  it('scores 6 letters as 3 points', () => {
    expect(scoreForLength(6)).toBe(3);
  });
  it('scores 7 letters as 5 points', () => {
    expect(scoreForLength(7)).toBe(5);
  });
  it('scores 8+ letters as 11 points', () => {
    expect(scoreForLength(8)).toBe(11);
    expect(scoreForLength(12)).toBe(11);
  });
  it('scores below 3 letters as 0', () => {
    expect(scoreForLength(2)).toBe(0);
  });
});

describe('BoggleEngine.submitWord', () => {
  it('rejects submissions before the game has started', () => {
    const engine = makeEngine();
    engine.addPlayer('u1');
    const path: Cell[] = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ];
    const result = engine.submitWord('u1', path);
    expect(result).toEqual({ accepted: false, reason: 'not_started' });
  });

  it('rejects an unknown player', () => {
    const engine = makeEngine();
    engine.start(0);
    const path: Cell[] = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ];
    const result = engine.submitWord('ghost', path, 1000);
    expect(result).toEqual({ accepted: false, reason: 'unknown_player' });
  });

  it('rejects a path that is not adjacency-valid, even if it spells a real word', () => {
    // C(0,0) -> A(0,1) -> T(0,2) is fine, but jumping C(0,0) -> T(0,2) directly
    // (skipping A) is not adjacent, even though letters at those two cells
    // alone would never spell a real word here; use a contrived non-adjacent
    // jump between two valid letters instead.
    const engine = makeEngine({ wordSet: new Set(['co']) });
    engine.start(0);
    engine.addPlayer('u1');
    // C(0,0) and O(1,0) are adjacent normally; force a non-adjacent pair:
    // C(0,0) -> O(2,1) is not adjacent (row diff 2).
    const path: Cell[] = [
      { row: 0, col: 0 },
      { row: 2, col: 1 },
    ];
    const result = engine.submitWord('u1', path, 1000);
    expect(result).toEqual({ accepted: false, reason: 'invalid_path' });
  });

  it('rejects a path that reuses a cell', () => {
    const engine = makeEngine();
    engine.start(0);
    engine.addPlayer('u1');
    const path: Cell[] = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 0 },
    ];
    const result = engine.submitWord('u1', path, 1000);
    expect(result).toEqual({ accepted: false, reason: 'invalid_path' });
  });

  it('rejects words shorter than 3 letters', () => {
    const engine = makeEngine({ wordSet: new Set(['ca']) });
    engine.start(0);
    engine.addPlayer('u1');
    const path: Cell[] = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ];
    const result = engine.submitWord('u1', path, 1000);
    expect(result).toEqual({ accepted: false, reason: 'too_short' });
  });

  it('rejects a valid path whose letters do not spell a dictionary word', () => {
    const engine = makeEngine({ wordSet: new Set(['cat']) });
    engine.start(0);
    engine.addPlayer('u1');
    // C(0,0) -> O(1,0) -> D(2,0) spells "COD", not in the word set.
    const path: Cell[] = [
      { row: 0, col: 0 },
      { row: 1, col: 0 },
      { row: 2, col: 0 },
    ];
    const result = engine.submitWord('u1', path, 1000);
    expect(result).toEqual({ accepted: false, reason: 'not_a_word' });
  });

  it('accepts a valid word and scores it', () => {
    const engine = makeEngine();
    engine.start(0);
    engine.addPlayer('u1');
    const path: Cell[] = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ];
    const result = engine.submitWord('u1', path, 1000);
    expect(result).toEqual({
      accepted: true,
      word: 'cat',
      points: 1,
      totalScore: 1,
    });
  });

  it('rejects a duplicate word from the same player', () => {
    const engine = makeEngine();
    engine.start(0);
    engine.addPlayer('u1');
    const path: Cell[] = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ];
    engine.submitWord('u1', path, 1000);
    const result = engine.submitWord('u1', path, 1001);
    expect(result).toEqual({ accepted: false, reason: 'already_found' });
  });

  it('lets two different players independently score the same word', () => {
    const engine = makeEngine();
    engine.start(0);
    engine.addPlayer('u1');
    engine.addPlayer('u2');
    const path: Cell[] = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ];
    const r1 = engine.submitWord('u1', path, 1000);
    const r2 = engine.submitWord('u2', path, 1000);
    expect(r1).toEqual({
      accepted: true,
      word: 'cat',
      points: 1,
      totalScore: 1,
    });
    expect(r2).toEqual({
      accepted: true,
      word: 'cat',
      points: 1,
      totalScore: 1,
    });
  });

  it('rejects submissions once the timer has expired', () => {
    const engine = makeEngine({ durationMs: 1000 });
    engine.start(0);
    engine.addPlayer('u1');
    const path: Cell[] = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ];
    const result = engine.submitWord('u1', path, 5000);
    expect(result).toEqual({ accepted: false, reason: 'already_ended' });
  });

  it('accumulates score across multiple distinct words for one player', () => {
    const engine = makeEngine({ wordSet: new Set(['cat', 'car']) });
    engine.start(0);
    engine.addPlayer('u1');
    engine.submitWord(
      'u1',
      [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
      ],
      1000,
    );
    const result = engine.submitWord(
      'u1',
      [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 1, col: 1 },
      ],
      1001,
    );
    expect(result).toEqual({
      accepted: true,
      word: 'car',
      points: 1,
      totalScore: 2,
    });
  });
});

describe('BoggleEngine.timeRemainingMs / isExpired', () => {
  it('reports the full duration before the game starts', () => {
    const engine = makeEngine({ durationMs: 180_000 });
    expect(engine.timeRemainingMs(0)).toBe(180_000);
    expect(engine.isExpired(0)).toBe(false);
  });

  it('counts down after start and clamps at zero', () => {
    const engine = makeEngine({ durationMs: 180_000 });
    engine.start(1_000);
    expect(engine.timeRemainingMs(61_000)).toBe(120_000);
    expect(engine.timeRemainingMs(1_000_000)).toBe(0);
    expect(engine.isExpired(1_000_000)).toBe(true);
  });
});

describe('BoggleEngine.getFinalResults', () => {
  it('sorts players by score descending and includes found words', () => {
    const engine = makeEngine({ wordSet: new Set(['cat', 'dog']) });
    engine.start(0);
    engine.addPlayer('u1');
    engine.addPlayer('u2');
    engine.submitWord(
      'u1',
      [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
      ],
      1000,
    );
    engine.submitWord(
      'u2',
      [
        { row: 2, col: 1 },
        { row: 2, col: 2 },
        { row: 2, col: 0 },
      ],
      1000,
    );
    // path above doesn't spell 'dog', use a valid one instead
    const results = engine.getFinalResults();
    expect(results.find((r) => r.userId === 'u1')).toEqual({
      userId: 'u1',
      score: 1,
      words: ['cat'],
    });
  });
});
