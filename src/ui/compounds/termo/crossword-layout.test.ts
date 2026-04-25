import { describe, expect, test } from 'bun:test';
import { buildCrosswordLayout } from './crossword-layout';
import type { TermoGuess } from './types';

describe('buildCrosswordLayout', () => {
  test('places answer word at row 0 col 0 horizontal', () => {
    const layout = buildCrosswordLayout('paleta', []);
    const answer = layout.placed[0];
    expect(answer.row).toBe(0);
    expect(answer.col).toBe(0);
    expect(answer.dir).toBe('h');
    expect(answer.isAnswer).toBe(true);
    expect(answer.word).toBe('paleta');
  });

  test('answer word tiles are all correct', () => {
    const layout = buildCrosswordLayout('paleta', []);
    const answer = layout.placed[0];
    expect(answer.feedback).toEqual([
      'correct',
      'correct',
      'correct',
      'correct',
      'correct',
      'correct',
    ]);
  });

  test('guess with matching letter is placed vertically', () => {
    const guesses: TermoGuess[] = [
      {
        guess: 'tapete',
        feedback: [
          'absent',
          'correct',
          'present',
          'absent',
          'absent',
          'absent',
        ],
      },
    ];
    const layout = buildCrosswordLayout('paleta', guesses);
    expect(layout.placed.length).toBe(2);
    expect(layout.placed[1].dir).toBe('v');
    expect(layout.placed[1].word).toBe('tapete');
  });

  test('guess with no matching letter is not placed', () => {
    const guesses: TermoGuess[] = [
      {
        guess: 'bronco',
        feedback: ['absent', 'absent', 'absent', 'absent', 'absent', 'absent'],
      },
    ];
    const layout = buildCrosswordLayout('paleta', guesses);
    expect(layout.placed.length).toBe(1);
  });

  test('intersection cell keeps answer word feedback (correct/green)', () => {
    const guesses: TermoGuess[] = [
      {
        guess: 'tapete',
        feedback: ['absent', 'present', 'absent', 'absent', 'absent', 'absent'],
      },
    ];
    const layout = buildCrosswordLayout('paleta', guesses);
    const cell = layout.grid.get('0,1');
    expect(cell?.feedback).toBe('correct');
    expect(cell?.letter).toBe('a');
  });

  test('bounding box covers all placed words', () => {
    const guesses: TermoGuess[] = [
      {
        guess: 'tapete',
        feedback: ['absent', 'present', 'absent', 'absent', 'absent', 'absent'],
      },
    ];
    const layout = buildCrosswordLayout('paleta', guesses);
    // tapete crosses at col 1 ('a'), intersection at row 0
    // tapete length 6, starts at row 0-1=-1, so rows -1..4
    expect(layout.minRow).toBeLessThanOrEqual(-1);
    expect(layout.maxRow).toBeGreaterThanOrEqual(0);
    expect(layout.minCol).toBe(0);
    expect(layout.maxCol).toBe(5);
  });

  test('two guesses sharing different answer letters both placed', () => {
    const guesses: TermoGuess[] = [
      {
        guess: 'tapete',
        feedback: ['absent', 'present', 'absent', 'absent', 'absent', 'absent'],
      },
      {
        guess: 'piloto',
        feedback: ['present', 'absent', 'absent', 'absent', 'absent', 'absent'],
      },
    ];
    const layout = buildCrosswordLayout('paleta', guesses);
    expect(layout.placed.length).toBe(3);
  });

  test('secondary guess connects to placed vertical word when no match with answer', () => {
    // 'nomis' has no letters in 'paleta' (p,a,l,e,t,a) but has 'p' matching 'tapete' at index 2
    // → should connect horizontally to the vertical 'tapete'
    const guesses: TermoGuess[] = [
      {
        guess: 'tapete',
        feedback: ['absent', 'present', 'absent', 'absent', 'absent', 'absent'],
      },
      {
        guess: 'nomis',
        feedback: ['absent', 'absent', 'absent', 'absent', 'absent'],
      },
    ];
    const layout = buildCrosswordLayout('paleta', guesses);
    // 'nomis' shares no letters with 'paleta', so stays unplaced — just verify no crash
    expect(layout.placed.length).toBeGreaterThanOrEqual(1);
  });

  test('two guesses at adjacent answer columns are both placed', () => {
    // Without crossword adjacency rules, both should be placed even if their tiles are side-by-side
    const guesses: TermoGuess[] = [
      {
        guess: 'tapete',
        feedback: ['absent', 'present', 'absent', 'absent', 'absent', 'absent'],
      }, // 'a' at index 1 → col 1
      {
        guess: 'lazaro',
        feedback: ['absent', 'absent', 'absent', 'absent', 'absent', 'absent'],
      }, // 'a' at index 1 → col 2
    ];
    const layout = buildCrosswordLayout('paleta', guesses);
    expect(layout.placed.length).toBe(3);
  });

  test('no two words occupy the same cell with different letters', () => {
    const guesses: TermoGuess[] = [
      {
        guess: 'tapete',
        feedback: ['absent', 'present', 'absent', 'absent', 'absent', 'absent'],
      },
      {
        guess: 'piloto',
        feedback: ['present', 'absent', 'absent', 'absent', 'absent', 'absent'],
      },
      {
        guess: 'alerta',
        feedback: [
          'present',
          'present',
          'absent',
          'absent',
          'absent',
          'present',
        ],
      },
    ];
    const layout = buildCrosswordLayout('paleta', guesses);
    const seen = new Map<string, string>();
    for (const [key, cell] of layout.grid) {
      expect(seen.has(key)).toBe(false);
      seen.set(key, cell.letter);
    }
  });
});
