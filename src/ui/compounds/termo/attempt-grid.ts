import { Column, Row, Style } from '@meonode/canvas';
import { defaultTheme, type Theme } from '../../theme';
import type { CanvasNode } from '../../types';
import { attemptRow } from './rows';
import type { TermoGuess } from './types';

export function attemptGrid(
  guesses: TermoGuess[],
  wordLength: number,
  maxAttempts: number,
  theme: Theme = defaultTheme,
): CanvasNode {
  const rightCount = maxAttempts <= 5 ? 0 : ((maxAttempts - 1) % 5) + 1;
  const leftCount = maxAttempts - rightCount;

  const leftColumn = Column({
    gap: 6,
    children: Array.from({ length: leftCount }, (_, i) =>
      attemptRow(guesses[i], wordLength, theme),
    ),
  });

  if (rightCount === 0) {
    return Row({
      width: '100%',
      justifyContent: Style.Justify.SpaceBetween,
      gap: 16,
      children: [leftColumn],
    });
  }

  return Row({
    width: '100%',
    justifyContent: Style.Justify.SpaceBetween,
    gap: 16,
    children: [
      leftColumn,
      Column({
        gap: 6,
        children: Array.from({ length: rightCount }, (_, i) =>
          attemptRow(guesses[leftCount + i], wordLength, theme),
        ),
      }),
    ],
  });
}
