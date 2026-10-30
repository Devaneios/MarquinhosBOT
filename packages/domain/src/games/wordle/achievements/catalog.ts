import { COLLECTIONS } from './content/collections';
import { GAMEPLAY } from './content/gameplay';
import { MILESTONES } from './content/milestones';
import { DIGITS } from './content/patterns/digits';
import { LETTERS } from './content/patterns/letters';
import { SHAPES } from './content/patterns/shapes';
import { TETROMINOES } from './content/patterns/tetrominoes';
import type { DrawingDefinition, WordleAchievementDefinition } from './types';

export const WORDLE_ACHIEVEMENT_CATALOG: readonly WordleAchievementDefinition[] =
  [
    ...MILESTONES,
    ...GAMEPLAY,
    ...LETTERS,
    ...DIGITS,
    ...TETROMINOES,
    ...SHAPES,
    ...COLLECTIONS,
  ];

export const WORDLE_DRAWING_CATALOG: readonly DrawingDefinition[] =
  WORDLE_ACHIEVEMENT_CATALOG.flatMap((definition) =>
    definition.kind === 'drawing' ? [definition.drawing] : [],
  );
