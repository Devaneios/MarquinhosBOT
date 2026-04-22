import { Column, Row, Style, Text } from '@meonode/canvas';
import {
  badge,
  card,
  labelText,
  panel,
  sectionHeader,
  statCard,
} from '../../primitives';
import { defaultTheme, type Theme } from '../../theme';
import type { CanvasNode } from '../../types';
import { type TermoStats, wordPreview } from './stats';

export type TermoNewWord = {
  word?: string;
  wordLength: number;
  wordDate?: string;
  message?: string;
  stats?: Partial<
    Pick<TermoStats, 'playersCount' | 'winnersCount' | 'avgAttempts'>
  >;
};

export function newWordPanel(
  data: TermoNewWord,
  options?: { revealWord?: boolean },
  theme: Theme = defaultTheme,
): CanvasNode {
  return panel(
    [
      Column({
        width: '100%',
        gap: theme.spacing.sm,
        children: [
          labelText('PALAVRA', { letterSpacing: 2 }, theme),
          wordPreview(
            data.word,
            data.wordLength,
            options?.revealWord === true,
            theme,
          ),
          Text(`${data.wordLength} letras`, {
            fontFamily: theme.fontFamilies.body,
            fontWeight: '600',
            fontSize: theme.fontSizes.md,
            color: theme.colors.textPrimary,
          }),
        ],
      }),
      ...(data.message !== undefined
        ? [
            Text(data.message, {
              fontFamily: theme.fontFamilies.body,
              fontWeight: '500',
              fontSize: theme.fontSizes.md,
              color: theme.colors.textMuted,
            }),
          ]
        : []),
    ],
    { padding: theme.spacing.md, gap: theme.spacing.md },
    theme,
  );
}

export function previousStatsPanel(
  stats: TermoNewWord['stats'],
  theme: Theme = defaultTheme,
): CanvasNode {
  return panel(
    [
      sectionHeader('RODADA ANTERIOR', undefined, theme),
      Row({
        width: '100%',
        justifyContent: Style.Justify.Center,
        gap: theme.spacing.md,
        children: [
          statCard('JOGADORES', stats?.playersCount ?? 0, theme),
          statCard('ACERTOS', stats?.winnersCount ?? 0, theme),
          statCard('MEDIA', stats?.avgAttempts ?? 0, theme),
        ],
      }),
    ],
    { padding: theme.spacing.md, gap: theme.spacing.md },
    theme,
  );
}

export function newWordCard(
  data: TermoNewWord,
  options?: { revealWord?: boolean; admin?: boolean },
  theme: Theme = defaultTheme,
): CanvasNode {
  return card(
    [
      sectionHeader(
        'NOVO TERMINHO',
        data.wordDate ?? (options?.admin === true ? 'ADMIN' : undefined),
        theme,
      ),
      newWordPanel(data, options, theme),
      ...(options?.admin === true
        ? [previousStatsPanel(data.stats, theme)]
        : [
            badge(
              'TERMINHOS',
              { bg: theme.colors.correct.bg, color: theme.colors.correct.text },
              theme,
            ),
          ]),
    ],
    theme,
  );
}
