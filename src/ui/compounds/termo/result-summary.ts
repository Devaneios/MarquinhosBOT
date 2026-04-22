import { Column, Row, Style, Text } from '@meonode/canvas';
import { panel, sectionHeader, statCard } from '../../primitives';
import { defaultTheme, type Theme } from '../../theme';
import type { CanvasNode } from '../../types';
import { resultTile } from './tiles';
import type { TermoGuess } from './types';

export function resultIntro(
  username: string,
  theme: Theme = defaultTheme,
): CanvasNode {
  return Column({
    width: '100%',
    alignItems: Style.Align.FlexStart,
    gap: theme.spacing.sm,
    children: [
      Text(`${username} acertou o Terminho de hoje.`, {
        fontFamily: theme.fontFamilies.body,
        fontWeight: '400',
        fontSize: theme.fontSizes.md,
        color: '#f1f1f1',
      }),
    ],
  });
}

export function resultStats(
  total: number,
  streak: number | undefined,
  theme: Theme = defaultTheme,
): CanvasNode {
  return Row({
    width: '100%',
    justifyContent: Style.Justify.Center,
    gap: 12,
    children: [statCard('TENTATIVAS', total, theme)],
  });
}

export function resultSummaryPanel(
  guesses: TermoGuess[],
  theme: Theme = defaultTheme,
): CanvasNode {
  return panel(
    [
      sectionHeader('RESUMO', undefined, theme),
      Column({
        width: '100%',
        alignItems: Style.Align.Center,
        gap: 6,
        children: guesses.map((guess) =>
          Row({
            justifyContent: Style.Justify.Center,
            gap: 5,
            children: guess.feedback.map((feedback) =>
              resultTile(feedback, theme),
            ),
          }),
        ),
      }),
    ],
    { padding: 12, gap: 10 },
    theme,
  );
}
