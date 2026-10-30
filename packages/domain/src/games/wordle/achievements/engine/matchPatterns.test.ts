import type { LetterFeedback } from '@marquinhos/contracts/wordle';
import { describe, expect, it } from 'bun:test';
import { WORDLE_DRAWING_CATALOG } from '../catalog';
import type { DrawingDefinition } from '../types';
import { matchWordlePatterns } from './matchPatterns';

function matrix(...rows: string[]): LetterFeedback[][] {
  return rows.map((row) =>
    [...row].map((c) =>
      c === 'c' ? 'correct' : c === 'p' ? 'present' : 'absent',
    ),
  );
}
const t: DrawingDefinition = {
  patternId: 'test_t',
  family: 'tetromino',
  mask: ['###', '.#.'],
  variants: [],
  colors: ['correct', 'present'],
  rotations: [0, 90, 180, 270],
};

describe('pattern matching', () => {
  it('contains all 59 complete drawing identities', () => {
    expect(WORDLE_DRAWING_CATALOG).toHaveLength(59);
    expect(new Set(WORDLE_DRAWING_CATALOG.map((p) => p.patternId)).size).toBe(
      59,
    );
    expect(
      WORDLE_DRAWING_CATALOG.filter((p) => p.family === 'letter'),
    ).toHaveLength(26);
    expect(
      WORDLE_DRAWING_CATALOG.filter((p) => p.family === 'digit'),
    ).toHaveLength(10);
  });
  it('matches every silhouette at both board edges and loses it when any required cell is removed', () => {
    for (const full of WORDLE_DRAWING_CATALOG) {
      const template = { ...full, variants: [] };
      for (const color of ['correct', 'present'] as const) {
        const exact = template.mask.map((row) =>
          [...row].map((cell) => (cell === '#' ? color : 'absent')),
        );
        for (const width of [5, 6]) {
          if (width < (template.mask[0]?.length ?? 0)) {
            expect(
              matchWordlePatterns(
                exact.map((row) => row.slice(0, width)),
                [template],
              ),
            ).toEqual([]);
            continue;
          }
          for (const column of [0, width - (template.mask[0]?.length ?? 0)]) {
            const board: LetterFeedback[][] = [
              Array<LetterFeedback>(width).fill('absent'),
              ...exact.map((row) => [
                ...Array<LetterFeedback>(column).fill('absent'),
                ...row,
                ...Array<LetterFeedback>(width - column - row.length).fill(
                  'absent',
                ),
              ]),
            ];
            const match = matchWordlePatterns(board, [template])[0];
            expect(match?.origin).toEqual([1, column]);
            expect(match?.color).toBe(color);
          }
        }
        const required = template.mask.flatMap((row, r) =>
          [...row].flatMap((cell, c) =>
            cell === '#' ? [[r, c] as const] : [],
          ),
        );
        for (const [row, column] of required) {
          const incomplete = exact.map((row) => [...row]);
          const changed = incomplete[row];
          if (!changed) throw new Error('missing required row');
          changed[column] = 'absent';
          expect(matchWordlePatterns(incomplete, [template])).toEqual([]);
        }
      }
    }
  });
  it('orders origins before color and honors each declared transform order', () => {
    expect(matchWordlePatterns(matrix('pppccc', 'apaccc'), [t])[0]?.color).toBe(
      'present',
    );
    expect(
      matchWordlePatterns(matrix('aca', 'cca', 'aca'), [
        { ...t, rotations: [90, 0] },
      ])[0]?.rotation,
    ).toBe(90);
  });
  it('does not reflect S into Z', () => {
    const s = WORDLE_DRAWING_CATALOG.find(
      (pattern) => pattern.patternId === 'tetromino_s',
    );
    const z = WORDLE_DRAWING_CATALOG.find(
      (pattern) => pattern.patternId === 'tetromino_z',
    );
    if (!s || !z) throw new Error('missing tetromino');
    expect(matchWordlePatterns(matrix('acc', 'cca'), [s])).toHaveLength(1);
    expect(matchWordlePatterns(matrix('acc', 'cca'), [z])).toHaveLength(0);
  });
  it('only matches the whole figure and chooses the first origin and declared rotation', () => {
    expect(matchWordlePatterns(matrix('ccccc', 'ccccc'), [t])).toEqual([]);
    expect(matchWordlePatterns(matrix('ccc', 'acc'), [t])).toEqual([]);
    expect(matchWordlePatterns(matrix('cccac', 'acaaa'), [t])).toEqual([
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
  it('treats a diagonal neighbor of the same color as part of the figure', () => {
    expect(matchWordlePatterns(matrix('cccaa', 'acaaa', 'aacaa'), [t])).toEqual(
      [],
    );
    expect(
      matchWordlePatterns(matrix('cccaa', 'acaaa', 'aaaac'), [t]),
    ).toHaveLength(1);
  });
  it('ignores the all-green winning row as a neighbor unless the pattern owns it', () => {
    const i = WORDLE_DRAWING_CATALOG.find((p) => p.patternId === 'tetromino_i');
    if (!i) throw new Error('missing tetromino_i');
    const bar = {
      ...i,
      rotations: [0] satisfies DrawingDefinition['rotations'],
    };
    expect(matchWordlePatterns(matrix('ccccaa', 'ccccaa'), [bar])).toEqual([]);
    expect(
      matchWordlePatterns(matrix('cccca', 'ccccc'), [bar])[0]?.origin,
    ).toEqual([0, 0]);
    expect(matchWordlePatterns(matrix('aaaaa', 'ccccc'), [bar])).toEqual([]);
    expect(
      matchWordlePatterns(matrix('aaaaa', 'cccca'), [bar])[0]?.origin,
    ).toEqual([1, 0]);
  });
  it('matches yellow independently and never combines foreground colors', () => {
    expect(matchWordlePatterns(matrix('ppp', 'apa'), [t])[0]?.color).toBe(
      'present',
    );
    expect(matchWordlePatterns(matrix('cpc', 'aca'), [t])).toEqual([]);
  });
  it('counts the winning row only for patterns that span the whole board width', () => {
    const bar = {
      ...t,
      mask: ['#####'],
      rotations: [0] satisfies DrawingDefinition['rotations'],
    };
    expect(matchWordlePatterns(matrix('ccccc'), [bar])).toHaveLength(1);
    expect(matchWordlePatterns(matrix('cccccc'), [bar])).toEqual([]);
  });
  it('rejects a six-column drawing on a five-column board and matches it on six', () => {
    const triangle: DrawingDefinition = {
      patternId: 'triangle_6',
      family: 'shape',
      mask: ['..##..', '.####.', '######'],
      variants: [],
      colors: ['correct', 'present'],
      rotations: [0],
    };
    const five = matrix('..cc.', '.ccc.', 'ccccc');
    const six = matrix('..cc..', '.cccc.', 'cccccc');
    expect(matchWordlePatterns(five, [triangle])).toEqual([]);
    expect(matchWordlePatterns(six, [triangle])).toMatchObject([
      { patternId: 'triangle_6', origin: [0, 0] },
    ]);
  });
  it('rejects a removed required cell, preserves offsets, and translates', () => {
    const upright = {
      ...t,
      rotations: [0] satisfies DrawingDefinition['rotations'],
    };
    expect(matchWordlePatterns(matrix('ccc', 'aaa'), [upright])).toEqual([]);
    expect(matchWordlePatterns(matrix('ccc', 'aac'), [upright])).toEqual([]);
    expect(
      matchWordlePatterns(matrix('aaaaa', 'accca', 'aacaa'), [upright])[0]
        ?.origin,
    ).toEqual([1, 1]);
  });
  it('rotates tetrominoes without reflecting their chirality', () => {
    const j = WORDLE_DRAWING_CATALOG.find((p) => p.patternId === 'tetromino_j');
    const l = WORDLE_DRAWING_CATALOG.find((p) => p.patternId === 'tetromino_l');
    if (!j || !l) throw new Error('missing tetromino');
    expect(matchWordlePatterns(matrix('caa', 'ccc'), [j])).toHaveLength(1);
    expect(matchWordlePatterns(matrix('caa', 'ccc'), [l])).toHaveLength(0);
    expect(matchWordlePatterns(matrix('cc', 'ca', 'ca'), [j])).toHaveLength(1);
  });
  it('keeps glyphs upright and ignores matrices too short or ragged', () => {
    const glyph = {
      ...t,
      rotations: [0] satisfies DrawingDefinition['rotations'],
    };
    expect(matchWordlePatterns(matrix('ca', 'cc', 'ca'), [glyph])).toEqual([]);
    expect(matchWordlePatterns(matrix('ccc'), [glyph])).toEqual([]);
    expect(matchWordlePatterns(matrix('ccc', 'cc'), [glyph])).toEqual([]);
  });
});

describe('wider pattern variants', () => {
  const h = WORDLE_DRAWING_CATALOG.find((p) => p.patternId === 'letter_h');
  if (!h?.variants?.length) throw new Error('letter_h needs a variant');

  it('matches the wide variant when the narrow base does not fit', () => {
    const wide = matrix('c...c', 'c...c', 'ccccc', 'c...c', 'c...c');
    const found = matchWordlePatterns(wide, [h]);
    expect(found).toHaveLength(1);
    expect(found[0]?.cells).toHaveLength(13);
  });

  it('every variant is minimal: removing any required cell breaks it', () => {
    for (const pattern of WORDLE_DRAWING_CATALOG) {
      for (const variant of pattern.variants ?? []) {
        const only = { ...pattern, mask: variant, variants: [] };
        const rows = variant.map((row) =>
          [...row].map((c) => (c === '#' ? 'c' : '.')).join(''),
        );
        expect(matchWordlePatterns(matrix(...rows), [only])).toHaveLength(1);
        rows.forEach((row, r) =>
          [...row].forEach((cell, c) => {
            if (cell !== 'c') return;
            const broken = rows.map((x, i) =>
              i === r ? `${x.slice(0, c)}.${x.slice(c + 1)}` : x,
            );
            expect(matchWordlePatterns(matrix(...broken), [only])).toHaveLength(
              0,
            );
          }),
        );
      }
    }
  });

  it('keeps every variant between the base width and the 6-column board', () => {
    for (const pattern of WORDLE_DRAWING_CATALOG)
      for (const variant of pattern.variants ?? []) {
        expect(variant[0]?.length).toBeGreaterThanOrEqual(
          pattern.mask[0]?.length ?? 0,
        );
        expect(variant[0]?.length).toBeLessThanOrEqual(6);
      }
  });

  it('has distinct variants with no empty edge columns', () => {
    for (const pattern of WORDLE_DRAWING_CATALOG) {
      const forms = [pattern.mask, ...(pattern.variants ?? [])];
      expect(new Set(forms.map((f) => f.join('\n'))).size).toBe(forms.length);
      for (const form of forms) {
        expect(form.some((row) => row.startsWith('#'))).toBe(true);
        expect(form.some((row) => row.endsWith('#'))).toBe(true);
      }
    }
  });

  it('draws every figure as itself and nothing else', () => {
    for (const pattern of WORDLE_DRAWING_CATALOG) {
      for (const form of [pattern.mask, ...(pattern.variants ?? [])]) {
        const boardWidth = Math.max(5, form[0]?.length ?? 0);
        const board = form.map((row) =>
          [...row]
            .map((c): LetterFeedback => (c === '#' ? 'correct' : 'absent'))
            .concat(
              Array<LetterFeedback>(boardWidth - row.length).fill('absent'),
            ),
        );
        const matches = matchWordlePatterns(board).map((m) => m.patternId);
        expect(matches).toContain(pattern.patternId);
        if (pattern.patternId === 'triangle_5')
          expect(matches).toEqual(['tetromino_t', 'triangle_5']);
        else expect(matches).toEqual([pattern.patternId]);
      }
    }
  });
});
