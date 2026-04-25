import { Column, Row, Style } from '@meonode/canvas';
import { defaultTheme, type Theme } from '../../theme';
import type { CanvasNode } from '../../types';
import { resultTile } from './tiles';
import type { TermoGuess } from './types';

export function resultSummaryPanel(
  guesses: TermoGuess[],
  theme: Theme = defaultTheme,
): CanvasNode {
  return Column({
    width: '100%',
    alignItems: Style.Align.Center,
    gap: 4,
    paddingLeft: 12,
    paddingRight: 12,
    children: guesses.map((guess) =>
      Row({
        justifyContent: Style.Justify.Center,
        gap: 4,
        children: guess.feedback.map((feedback) => resultTile(feedback, theme)),
      }),
    ),
  });
}
