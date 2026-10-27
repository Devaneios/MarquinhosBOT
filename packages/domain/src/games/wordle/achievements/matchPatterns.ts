import {
  guessRowSchema,
  type LetterFeedback,
  type WordlePatternEvidence,
  type WordlePatternPreview,
} from '@marquinhos/contracts/wordle';
import { z } from 'zod';
import {
  WORDLE_PATTERN_CATALOG,
  type WordlePatternDefinition,
} from './patterns';

type Match = Omit<WordlePatternEvidence, 'feedback' | 'date'>;
type Cell = WordlePatternEvidence['cells'][number];

export function parseAchievementMatrix(
  serializedGuesses: string,
  expectedWidth: number | null,
  attempts: number,
): LetterFeedback[][] | null {
  if (expectedWidth === null || expectedWidth <= 0 || attempts <= 0)
    return null;
  try {
    const result = z
      .array(guessRowSchema)
      .safeParse(JSON.parse(serializedGuesses));
    if (
      !result.success ||
      result.data.length !== attempts ||
      result.data.some(
        (row) =>
          row.feedback.length !== expectedWidth ||
          row.guess.length !== expectedWidth,
      )
    )
      return null;
    return result.data.map((row) => row.feedback);
  } catch {
    return null;
  }
}

function geometry(
  mask: readonly string[],
  rotation: WordlePatternPreview['rotations'][number],
): { cells: Cell[]; height: number; width: number } {
  let height = mask.length;
  let width = mask[0]?.length ?? 0;
  let cells: Cell[] = mask.flatMap((row, r) =>
    [...row].flatMap((cell, c) =>
      cell === '#' ? [[r, c] satisfies Cell] : [],
    ),
  );
  for (let turn = 0; turn < rotation / 90; turn++) {
    cells = cells.map(([r, c]) => [c, height - 1 - r]);
    [height, width] = [width, height];
  }
  cells.sort(([ar, ac], [br, bc]) => ar - br || ac - bc);
  return { cells, height, width };
}

export function matchWordlePatterns(
  matrix: readonly (readonly LetterFeedback[])[],
  templates: readonly WordlePatternDefinition[] = WORDLE_PATTERN_CATALOG,
): Match[] {
  const width = matrix[0]?.length ?? 0;
  if (width === 0 || matrix.some((row) => row.length !== width)) return [];
  const matches: Match[] = [];
  for (const template of templates) {
    const rotations = template.rotations.map((rotation) => ({
      rotation,
      ...geometry(template.mask, rotation),
    }));
    let found: Match | undefined;
    for (let row = 0; row < matrix.length && !found; row++) {
      for (let column = 0; column < width && !found; column++) {
        for (const color of [
          'correct',
          'present',
        ] satisfies WordlePatternPreview['colors']) {
          if (!template.colors.includes(color)) continue;
          for (const shape of rotations) {
            if (
              row + shape.height > matrix.length ||
              column + shape.width > width ||
              shape.cells.length === 0
            )
              continue;
            const cells: Cell[] = shape.cells.map(([r, c]) => [
              row + r,
              column + c,
            ]);
            if (cells.every(([r, c]) => matrix[r]?.[c] === color)) {
              found = {
                patternId: template.id,
                color,
                origin: [row, column],
                rotation: shape.rotation,
                cells,
              };
              break;
            }
          }
          if (found) break;
        }
      }
    }
    if (found) matches.push(found);
  }
  return matches;
}
