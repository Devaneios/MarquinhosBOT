import { Box, Column, Row, Style, Text } from '@meonode/canvas';
import { defaultTheme, type Theme } from '../../theme';
import type { CanvasNode } from '../../types';
import type { CrosswordLayout } from './crossword-layout';
import type { LetterFeedback } from './letter-states';
import { attemptTile } from './tiles';

function spacerTile(): CanvasNode {
  return Box({ width: 32, height: 32 });
}

function answerTile(
  feedback: LetterFeedback,
  letter: string,
  theme: Theme,
): CanvasNode {
  const colors = theme.colors[feedback];
  return Box({
    width: 32,
    height: 32,
    backgroundColor: colors.bg,
    borderRadius: theme.radii.sm,
    border: 2,
    borderColor: 'rgba(255, 255, 255, 0.55)',
    boxShadow: [
      {
        inset: true,
        offsetX: 0,
        offsetY: 1,
        blur: 3,
        color: 'rgba(255, 255, 255, 0.25)',
      },
      {
        inset: true,
        offsetX: 0,
        offsetY: -1,
        blur: 3,
        color: 'rgba(0, 0, 0, 0.2)',
      },
    ],
    justifyContent: Style.Justify.Center,
    alignItems: Style.Align.Center,
    children: [
      Text(letter.toUpperCase(), {
        fontFamily: theme.fontFamilies.heading,
        fontWeight: 'bold',
        fontSize: theme.fontSizes.lg,
        color: colors.text,
      }),
    ],
  });
}

export function crosswordGrid(
  layout: CrosswordLayout,
  theme: Theme = defaultTheme,
): CanvasNode {
  const rows = layout.maxRow - layout.minRow + 1;
  const cols = layout.maxCol - layout.minCol + 1;

  const answer = layout.placed.find((p) => p.isAnswer)!;
  const answerGridRow = answer.row - layout.minRow;
  const answerGridColStart = answer.col - layout.minCol;
  const answerGridColEnd = answerGridColStart + answer.word.length - 1;

  return Column({
    gap: 4,
    children: Array.from({ length: rows }, (_, r) =>
      Row({
        gap: 4,
        children: Array.from({ length: cols }, (_, c) => {
          const cell = layout.grid.get(
            `${r + layout.minRow},${c + layout.minCol}`,
          );
          if (!cell) return spacerTile();
          const isAnswer =
            r === answerGridRow &&
            c >= answerGridColStart &&
            c <= answerGridColEnd;
          return isAnswer
            ? answerTile(cell.feedback, cell.letter, theme)
            : attemptTile(cell.feedback, cell.letter, theme);
        }),
      }),
    ),
  });
}
