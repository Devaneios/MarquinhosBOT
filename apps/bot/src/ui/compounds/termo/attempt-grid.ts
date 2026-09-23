import type { GuessRow } from '@marquinhos/contracts/wordle';
import { Column, Row, Style } from '@meonode/canvas';
import { defaultTheme, type Theme } from '../../theme';
import type { CanvasNode } from '../../types';
import { attemptRow } from './rows';

export function attemptGrid(
  guesses: GuessRow[],
  wordLength: number,
  maxAttempts: number,
  theme: Theme = defaultTheme,
): CanvasNode {
  const leftColumn = Column({
    gap: 4,
    children: Array.from({ length: guesses.length }, (_, i) =>
      attemptRow(guesses[i], wordLength, theme),
    ),
  });

  return Row({
    width: '100%',
    justifyContent: Style.Justify.Center,
    gap: 16,
    children: [leftColumn],
  });
}
