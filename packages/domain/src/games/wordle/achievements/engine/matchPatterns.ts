import type {
  LetterFeedback,
  WordlePatternEvidence,
  WordlePatternPreview,
} from '@marquinhos/contracts/wordle';
import { WORDLE_PATTERN_CATALOG } from '../patterns';
import type { WordlePatternDefinition } from '../types';

type Match = Omit<WordlePatternEvidence, 'feedback' | 'date'>;
type Cell = WordlePatternEvidence['cells'][number];

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

/**
 * The drawing is the whole group of same-colored cells it belongs to: a
 * same-colored neighbor (diagonals included) that the pattern does not contain
 * means the player drew a different figure. The all-green winning row only
 * counts when the pattern itself reaches it; otherwise it is ignored.
 */
function isExactFigure(
  matrix: readonly (readonly LetterFeedback[])[],
  cells: readonly Cell[],
  color: LetterFeedback,
): boolean {
  const owned = new Set(cells.map(([r, c]) => `${r},${c}`));
  const lastRow = matrix.length - 1;
  const winningRow =
    matrix[lastRow]?.every((cell) => cell === 'correct') &&
    !cells.some(([row]) => row === lastRow)
      ? lastRow
      : -1;
  return cells.every(([row, column]) =>
    [-1, 0, 1].every((dr) =>
      [-1, 0, 1].every((dc) => {
        const r = row + dr;
        const c = column + dc;
        return (
          r === winningRow || matrix[r]?.[c] !== color || owned.has(`${r},${c}`)
        );
      }),
    ),
  );
}

export function matchWordlePatterns(
  matrix: readonly (readonly LetterFeedback[])[],
  templates: readonly WordlePatternDefinition[] = WORDLE_PATTERN_CATALOG,
): Match[] {
  const width = matrix[0]?.length ?? 0;
  if (width === 0 || matrix.some((row) => row.length !== width)) return [];
  const matches: Match[] = [];
  for (const template of templates) {
    const rotations = [template.mask, ...(template.variants ?? [])].flatMap(
      (mask) =>
        template.rotations.map((rotation) => ({
          rotation,
          ...geometry(mask, rotation),
        })),
    );
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
            if (
              cells.every(([r, c]) => matrix[r]?.[c] === color) &&
              isExactFigure(matrix, cells, color)
            ) {
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
