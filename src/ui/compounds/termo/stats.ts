import { Column, Row, Style, Text } from '@meonode/canvas';
import { labelText, panel, sectionHeader, statCard } from '../../primitives';
import { defaultTheme, type Theme } from '../../theme';
import type { CanvasNode } from '../../types';
import { attemptTile, emptyTile } from './tiles';

export type TermoStats = {
  wordDate?: string;
  word?: string;
  wordLength: number;
  playersCount: number;
  winnersCount: number;
  avgAttempts: number;
};

export function wordPreview(
  word: string | undefined,
  wordLength: number,
  reveal: boolean,
  theme: Theme = defaultTheme,
): CanvasNode {
  return Row({
    justifyContent: Style.Justify.Center,
    gap: 4,
    children:
      reveal && word !== undefined
        ? word.split('').map((letter) => attemptTile('correct', letter, theme))
        : Array.from({ length: wordLength }, () => emptyTile(theme)),
  });
}

export function termoStatsGrid(
  stats: TermoStats,
  theme: Theme = defaultTheme,
): CanvasNode {
  return Column({
    width: '100%',
    gap: theme.spacing.md,
    children: [
      Row({
        width: '100%',
        justifyContent: Style.Justify.Center,
        gap: theme.spacing.md,
        children: [
          statCard('JOGADORES', stats.playersCount, theme),
          statCard('ACERTOS', stats.winnersCount, theme),
        ],
      }),
      Row({
        width: '100%',
        justifyContent: Style.Justify.Center,
        gap: theme.spacing.md,
        children: [
          statCard('MEDIA', stats.avgAttempts, theme),
          statCard('LETRAS', stats.wordLength, theme),
        ],
      }),
    ],
  });
}

export function termoStatsPanel(
  stats: TermoStats,
  options?: { title?: string; revealWord?: boolean },
  theme: Theme = defaultTheme,
): CanvasNode {
  return panel(
    [
      sectionHeader(options?.title ?? 'STATUS', stats.wordDate, theme),
      Column({
        width: '100%',
        alignItems: Style.Align.Center,
        gap: theme.spacing.sm,
        children: [
          labelText(
            options?.revealWord ? 'PALAVRA' : 'PALAVRA DE HOJE',
            { letterSpacing: 2 },
            theme,
          ),
          wordPreview(
            stats.word,
            stats.wordLength,
            options?.revealWord === true,
            theme,
          ),
        ],
      }),
      termoStatsGrid(stats, theme),
    ],
    { padding: theme.spacing.md, gap: theme.spacing.md },
    theme,
  );
}

export function statsLead(
  title: string,
  subtitle: string | undefined,
  theme: Theme = defaultTheme,
): CanvasNode {
  return Column({
    width: '100%',
    gap: theme.spacing.xs,
    children: [
      Text(title, {
        fontFamily: theme.fontFamilies.heading,
        fontWeight: 'bold',
        fontSize: theme.fontSizes.xl,
        color: theme.colors.textPrimary,
      }),
      ...(subtitle !== undefined
        ? [
            Text(subtitle, {
              fontFamily: theme.fontFamilies.body,
              fontWeight: '500',
              fontSize: theme.fontSizes.md,
              color: theme.colors.textMuted,
            }),
          ]
        : []),
    ],
  });
}
