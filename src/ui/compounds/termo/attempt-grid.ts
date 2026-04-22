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
  const halfRows = Math.ceil(maxAttempts / 2);

  return Row({
    width: '100%',
    justifyContent: Style.Justify.SpaceBetween,
    gap: 16,
    children: [
      Column({
        gap: 6,
        children: Array.from({ length: halfRows }, (_, i) =>
          attemptRow(guesses[i], wordLength, theme),
        ),
      }),
      Column({
        gap: 6,
        children: Array.from({ length: maxAttempts - halfRows }, (_, i) =>
          attemptRow(guesses[halfRows + i], wordLength, theme),
        ),
      }),
    ],
  });
}
