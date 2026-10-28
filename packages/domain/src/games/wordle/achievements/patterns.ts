import type { WordlePatternPreview } from '@marquinhos/contracts/wordle';
import { DIGITS } from './content/patterns/digits';
import { LETTERS } from './content/patterns/letters';
import { SHAPES } from './content/patterns/shapes';
import { TETROMINOES } from './content/patterns/tetrominoes';
import { PATTERN_FAMILY_DEFAULTS } from './families';
import type { PatternSpec, WordlePatternDefinition } from './types';

function parseMask(mask: string): string[] {
  return mask
    .trim()
    .split('\n')
    .map((row) => row.trim());
}

function pattern(spec: PatternSpec): WordlePatternDefinition {
  const defaults = PATTERN_FAMILY_DEFAULTS[spec.family];
  return {
    id: spec.id,
    patternId: spec.id,
    family: spec.family,
    name: spec.name,
    mask: parseMask(spec.mask),
    variants: (spec.variants ?? []).map(parseMask),
    colors: [...(spec.colors ?? defaults.colors)],
    rotations: [...(spec.rotations ?? defaults.rotations)],
  };
}

export const WORDLE_PATTERN_CATALOG: readonly WordlePatternDefinition[] = [
  ...LETTERS,
  ...DIGITS,
  ...TETROMINOES,
  ...SHAPES,
].map(pattern);

export function getWordlePatternPreview(
  patternId: string,
): WordlePatternPreview | undefined {
  const definition = WORDLE_PATTERN_CATALOG.find((p) => p.id === patternId);
  if (!definition) return undefined;
  const { mask, variants, colors, rotations } = definition;
  return { patternId, mask, variants, colors, rotations };
}
