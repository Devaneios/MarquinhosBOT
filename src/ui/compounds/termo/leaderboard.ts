import { Box, Column, Row, Style, Text } from '@meonode/canvas';
import { card, divider, sectionHeader } from '../../primitives';
import { defaultTheme, type Theme } from '../../theme';
import type { CanvasNode } from '../../types';

export type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly' | 'all-time';

export type DailyEntry = {
  rank: number;
  displayName: string;
  attempts: number;
  solved: boolean;
};

export type RankedEntry = {
  rank: number;
  displayName: string;
  avgScore: number;
  totalDays: number;
};

const PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  daily: 'Hoje',
  weekly: 'Esta Semana',
  monthly: 'Este Mês',
  'all-time': 'Histórico',
};

const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'] as const;

function rankText(rank: number, theme: Theme): CanvasNode {
  const color = rank <= 3 ? RANK_COLORS[rank - 1] : theme.colors.textMuted;
  return Text(`#${rank}`, {
    fontFamily: theme.fontFamilies.heading,
    fontWeight: 'bold',
    fontSize: theme.fontSizes.md,
    color,
  });
}

function nameText(name: string, muted: boolean, theme: Theme): CanvasNode {
  return Text(name, {
    fontFamily: theme.fontFamilies.body,
    fontWeight: '500',
    fontSize: theme.fontSizes.md,
    color: muted ? theme.colors.textMuted : theme.colors.textPrimary,
  });
}

function valueText(value: string, theme: Theme): CanvasNode {
  return Text(value, {
    fontFamily: theme.fontFamilies.heading,
    fontWeight: 'bold',
    fontSize: theme.fontSizes.md,
    color: theme.colors.accent,
  });
}

function dailyRow(entry: DailyEntry, theme: Theme): CanvasNode {
  return Row({
    width: '100%',
    justifyContent: Style.Justify.SpaceBetween,
    alignItems: Style.Align.Center,
    gap: theme.spacing.sm,
    children: [
      Box({ width: 28, children: [rankText(entry.rank, theme)] }),
      Box({
        flexGrow: 1,
        children: [nameText(entry.displayName, !entry.solved, theme)],
      }),
      valueText(entry.solved ? String(entry.attempts) : '—', theme),
    ],
  });
}

function rankedRow(entry: RankedEntry, theme: Theme): CanvasNode {
  return Row({
    width: '100%',
    justifyContent: Style.Justify.SpaceBetween,
    alignItems: Style.Align.Center,
    gap: theme.spacing.sm,
    children: [
      Box({ width: 28, children: [rankText(entry.rank, theme)] }),
      Box({
        flexGrow: 1,
        children: [nameText(entry.displayName, false, theme)],
      }),
      Row({
        gap: theme.spacing.lg,
        alignItems: Style.Align.Center,
        children: [
          valueText(String(entry.avgScore), theme),
          Text(`${entry.totalDays}d`, {
            fontFamily: theme.fontFamilies.body,
            fontSize: theme.fontSizes.sm,
            color: theme.colors.textMuted,
          }),
        ],
      }),
    ],
  });
}

function groupStreakBadge(streak: number, theme: Theme): CanvasNode {
  return Text(
    `Sequência do servidor: ${streak} dia${streak !== 1 ? 's' : ''}`,
    {
      fontFamily: theme.fontFamilies.body,
      fontSize: theme.fontSizes.sm,
      color: theme.colors.textMuted,
    },
  );
}

export function termoLeaderboardCard(
  entries: (DailyEntry | RankedEntry)[],
  period: LeaderboardPeriod,
  groupStreak: number,
  theme: Theme = defaultTheme,
): CanvasNode {
  const title = `Terminhos — ${PERIOD_LABELS[period]}`;
  const isDailyEntry = (e: DailyEntry | RankedEntry): e is DailyEntry =>
    'solved' in e;

  const rows: CanvasNode[] = [];
  for (const entry of entries) {
    if (rows.length > 0) {
      rows.push(divider({}, theme));
    }
    rows.push(
      isDailyEntry(entry) ? dailyRow(entry, theme) : rankedRow(entry, theme),
    );
  }

  return card(
    [
      Column({
        width: '100%',
        gap: theme.spacing.xs,
        children: [
          sectionHeader(title, undefined, theme),
          groupStreakBadge(groupStreak, theme),
        ],
      }),
      ...(rows.length > 0
        ? [Column({ width: '100%', gap: theme.spacing.sm, children: rows })]
        : []),
    ],
    theme,
  );
}
