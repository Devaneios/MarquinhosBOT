import type { DrawingDefinition } from '../types';

export type WordlePatternWitnessReference = {
  patternId: string;
  variant?: number;
  color: string;
};

export type WordlePatternWitnessRequirement = {
  patternId: string;
  variant: number;
  color: 'correct' | 'present';
};

export function wordlePatternWitnessKey(
  witness: WordlePatternWitnessReference,
): string {
  return `${witness.patternId}#${witness.variant ?? 0}/${witness.color}`;
}

export function requiredWordlePatternWitnesses(
  patterns: readonly DrawingDefinition[],
): WordlePatternWitnessRequirement[] {
  return patterns.flatMap((pattern) =>
    [pattern.mask, ...(pattern.variants ?? [])].flatMap((_, variant) =>
      (['correct', 'present'] as const).map((color) => ({
        patternId: pattern.patternId,
        variant,
        color,
      })),
    ),
  );
}

export function missingWordlePatternWitnesses(
  patterns: readonly DrawingDefinition[],
  witnesses: readonly WordlePatternWitnessReference[],
): string[] {
  const available = new Set(witnesses.map(wordlePatternWitnessKey));
  return requiredWordlePatternWitnesses(patterns)
    .filter(
      (requirement) => !available.has(wordlePatternWitnessKey(requirement)),
    )
    .map(wordlePatternWitnessKey);
}
