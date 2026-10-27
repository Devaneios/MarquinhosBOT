import type { LetterFeedback } from '@marquinhos/contracts/wordle';
import { describe, expect, it } from 'bun:test';
import { matchWordlePatterns, parseAchievementMatrix } from './matchPatterns';
import {
  WORDLE_PATTERN_CATALOG,
  type WordlePatternDefinition,
} from './patterns';

function matrix(...rows: string[]): LetterFeedback[][] {
  return rows.map((row) =>
    [...row].map((c) =>
      c === 'c' ? 'correct' : c === 'p' ? 'present' : 'absent',
    ),
  );
}
const t: WordlePatternDefinition = {
  id: 'test_t',
  patternId: 'test_t',
  family: 'tetromino',
  name: 'T',
  mask: ['###', '.#.'],
  colors: ['correct', 'present'],
  rotations: [0, 90, 180, 270],
};

describe('pattern matching', () => {
  it('contains all 53 complete launch identities', () => {
    expect(WORDLE_PATTERN_CATALOG).toHaveLength(53);
    expect(new Set(WORDLE_PATTERN_CATALOG.map((p) => p.id)).size).toBe(53);
    expect(
      WORDLE_PATTERN_CATALOG.filter((p) => p.family === 'letter'),
    ).toHaveLength(26);
    expect(
      WORDLE_PATTERN_CATALOG.filter((p) => p.family === 'digit'),
    ).toHaveLength(10);
  });
  it('matches dense subsets and chooses the first origin and declared rotation', () => {
    expect(matchWordlePatterns(matrix('ccccc', 'ccccc'), [t])).toEqual([
      {
        patternId: 'test_t',
        color: 'correct',
        origin: [0, 0],
        rotation: 0,
        cells: [
          [0, 0],
          [0, 1],
          [0, 2],
          [1, 1],
        ],
      },
    ]);
  });
  it('matches yellow independently and never combines foreground colors', () => {
    expect(matchWordlePatterns(matrix('ppp', 'apa'), [t])[0]?.color).toBe(
      'present',
    );
    expect(matchWordlePatterns(matrix('cpc', 'aca'), [t])).toEqual([]);
  });
  it('uses the winning row and both board widths', () => {
    for (const row of ['ccccc', 'cccccc'])
      expect(
        matchWordlePatterns(matrix(row)).some(
          (m) => m.patternId === 'tetromino_i',
        ),
      ).toBe(true);
  });
  it('rejects a removed required cell, preserves offsets, and translates', () => {
    const upright = {
      ...t,
      rotations: [0] satisfies WordlePatternDefinition['rotations'],
    };
    expect(matchWordlePatterns(matrix('ccc', 'aaa'), [upright])).toEqual([]);
    expect(matchWordlePatterns(matrix('ccc', 'aac'), [upright])).toEqual([]);
    expect(
      matchWordlePatterns(matrix('aaaaa', 'accca', 'aacaa'), [upright])[0]
        ?.origin,
    ).toEqual([1, 1]);
  });
  it('rotates tetrominoes without reflecting their chirality', () => {
    const j = WORDLE_PATTERN_CATALOG.find((p) => p.id === 'tetromino_j');
    const l = WORDLE_PATTERN_CATALOG.find((p) => p.id === 'tetromino_l');
    if (!j || !l) throw new Error('missing tetromino');
    expect(matchWordlePatterns(matrix('caa', 'ccc'), [j])).toHaveLength(1);
    expect(matchWordlePatterns(matrix('caa', 'ccc'), [l])).toHaveLength(0);
    expect(matchWordlePatterns(matrix('cc', 'ca', 'ca'), [j])).toHaveLength(1);
  });
  it('keeps glyphs upright and ignores matrices too short or ragged', () => {
    const glyph = {
      ...t,
      rotations: [0] satisfies WordlePatternDefinition['rotations'],
    };
    expect(matchWordlePatterns(matrix('ca', 'cc', 'ca'), [glyph])).toEqual([]);
    expect(matchWordlePatterns(matrix('ccc'), [glyph])).toEqual([]);
    expect(matchWordlePatterns(matrix('ccc', 'cc'), [glyph])).toEqual([]);
  });
});

describe('parseAchievementMatrix', () => {
  const valid = JSON.stringify([
    {
      guess: 'teste',
      feedback: ['correct', 'present', 'absent', 'absent', 'absent'],
    },
  ]);
  it('preserves all accepted rows', () =>
    expect(parseAchievementMatrix(valid, 5, 1)).toEqual(matrix('cpaaa')));
  it('rejects corrupt middle rows rather than joining the neighbors', () => {
    const rows = [
      {
        guess: 'teste',
        feedback: ['correct', 'present', 'absent', 'absent', 'absent'],
      },
      { guess: 'ruim', feedback: ['invalid'] },
      {
        guess: 'teste',
        feedback: ['correct', 'present', 'absent', 'absent', 'absent'],
      },
    ];
    expect(parseAchievementMatrix(JSON.stringify(rows), 5, 3)).toBeNull();
  });
  it('rejects malformed JSON, unknown width, mismatched counters and row widths', () => {
    for (const [json, width, attempts] of [
      [valid, null, 1],
      [valid, 6, 1],
      [valid, 5, 2],
      ['bad', 5, 1],
      ['[]', 5, 0],
    ] satisfies [string, number | null, number][])
      expect(parseAchievementMatrix(json, width, attempts)).toBeNull();
  });
});
