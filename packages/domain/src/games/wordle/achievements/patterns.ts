import type { WordlePatternPreview } from '@marquinhos/contracts/wordle';

export type WordlePatternFamily = 'letter' | 'digit' | 'tetromino' | 'shape';
export interface WordlePatternDefinition extends WordlePatternPreview {
  id: string;
  family: WordlePatternFamily;
  name: string;
}

const LETTERS: Readonly<Record<string, string[]>> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  N: ['#.#', '###', '###', '###', '#.#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '###', '..#'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '.#.', '.#.'],
  W: ['#.#', '#.#', '###', '###', '#.#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'],
};
const DIGITS: Readonly<Record<string, string[]>> = {
  0: ['###', '#.#', '#.#', '#.#', '###'],
  1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['##.', '..#', '.#.', '#..', '###'],
  3: ['##.', '..#', '.#.', '..#', '##.'],
  4: ['#.#', '#.#', '###', '..#', '..#'],
  5: ['###', '#..', '##.', '..#', '##.'],
  6: ['.##', '#..', '###', '#.#', '###'],
  7: ['###', '..#', '.#.', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '##.'],
};
const TETROMINOES: Readonly<Record<string, string[]>> = {
  i: ['####'],
  o: ['##', '##'],
  t: ['###', '.#.'],
  j: ['#..', '###'],
  l: ['..#', '###'],
  s: ['.##', '##.'],
  z: ['##.', '.##'],
};
const SHAPES: readonly [string, string, string[]][] = [
  ['square_outline', 'Quadrado vazado', ['###', '#.#', '###']],
  ['diamond_outline', 'Losango', ['.#.', '#.#', '.#.']],
  ['cross', 'Cruz', ['.#.', '###', '.#.']],
  ['heart', 'Coração', ['#.#', '###', '###', '.#.']],
  ['arrow_up', 'Seta para cima', ['.#.', '###', '.#.', '.#.']],
  ['arrow_down', 'Seta para baixo', ['.#.', '.#.', '###', '.#.']],
  ['arrow_left', 'Seta para a esquerda', ['..#', '.##', '###', '.##', '..#']],
  ['arrow_right', 'Seta para a direita', ['#..', '##.', '###', '##.', '#..']],
  ['staircase', 'Escadinha', ['#..', '##.', '###']],
  ['hourglass', 'Ampulheta', ['###', '.#.', '###']],
];

function pattern(
  id: string,
  family: WordlePatternFamily,
  name: string,
  mask: string[],
): WordlePatternDefinition {
  return {
    id,
    patternId: id,
    family,
    name,
    mask,
    colors: ['correct', 'present'],
    rotations: family === 'tetromino' ? [0, 90, 180, 270] : [0],
  };
}

export const WORDLE_PATTERN_CATALOG: readonly WordlePatternDefinition[] = [
  ...Object.entries(LETTERS).map(([letter, mask]) =>
    pattern(
      `letter_${letter.toLowerCase()}`,
      'letter',
      `Letra ${letter}`,
      mask,
    ),
  ),
  ...Object.entries(DIGITS).map(([digit, mask]) =>
    pattern(`digit_${digit}`, 'digit', `Número ${digit}`, mask),
  ),
  ...Object.entries(TETROMINOES).map(([name, mask]) =>
    pattern(
      `tetromino_${name}`,
      'tetromino',
      `Tetraminó ${name.toUpperCase()}`,
      mask,
    ),
  ),
  ...SHAPES.map(([id, name, mask]) => pattern(id, 'shape', name, mask)),
];

export function getWordlePatternPreview(
  patternId: string,
): WordlePatternPreview | undefined {
  const definition = WORDLE_PATTERN_CATALOG.find((p) => p.id === patternId);
  if (!definition) return undefined;
  const { mask, colors, rotations } = definition;
  return { patternId, mask, colors, rotations };
}
