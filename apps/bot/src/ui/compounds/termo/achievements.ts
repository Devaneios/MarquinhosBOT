import type {
  LetterFeedback,
  WordleAchievementStatus,
  WordlePlayerStats,
} from '@marquinhos/contracts/wordle';
import { Box, Column, Row, Style, Text } from '@meonode/canvas';
import { card, labelText, progressBar } from '../../primitives';
import { defaultTheme, type Theme } from '../../theme';
import type { CanvasNode } from '../../types';

export type TermoAchievementsFamilyRow = {
  label: string;
  unlocked: number;
  total: number;
};

export type TermoAchievementsCardInput = {
  displayName: string;
  stats: WordlePlayerStats;
  unlocked: number;
  total: number;
  families: TermoAchievementsFamilyRow[];
};

const RETRO_FONT = 'Press Start 2P';
const DISTRIBUTION_LABELS = ['1', '2', '3', '4', '5', '6', '7+'];
const DISTRIBUTION_BAR_MAX = 300;
const DISTRIBUTION_BAR_MIN = 22;
const FAMILY_BAR_WIDTH = 230;
const ROW_LABEL_WIDTH = 140;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function header(input: TermoAchievementsCardInput, theme: Theme): CanvasNode {
  return Row({
    width: '100%',
    justifyContent: Style.Justify.SpaceBetween,
    alignItems: Style.Align.Center,
    children: [
      Column({
        gap: theme.spacing.xs,
        children: [
          Text('CONQUISTAS', {
            fontFamily: RETRO_FONT,
            fontSize: theme.fontSizes.lg,
            color: theme.colors.accent,
          }),
          Text(truncate(input.displayName, 28), {
            fontFamily: theme.fontFamilies.heading,
            fontWeight: 'bold',
            fontSize: theme.fontSizes.xl,
            color: theme.colors.textPrimary,
          }),
        ],
      }),
      Text(`${input.unlocked}/${input.total}`, {
        fontFamily: RETRO_FONT,
        fontSize: theme.fontSizes.xl,
        color: theme.colors.textPrimary,
      }),
    ],
  });
}

function statTile(label: string, value: string, theme: Theme): CanvasNode {
  return Column({
    flexGrow: 1,
    flexBasis: 0,
    alignItems: Style.Align.Center,
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.md,
    padding: { Vertical: theme.spacing.md, Horizontal: theme.spacing.xs },
    children: [
      Text(value, {
        fontFamily: theme.fontFamilies.heading,
        fontWeight: 'bold',
        fontSize: theme.fontSizes.display,
        color: theme.colors.textPrimary,
      }),
      labelText(label, { letterSpacing: 1 }, theme),
    ],
  });
}

function statsRow(stats: WordlePlayerStats, theme: Theme): CanvasNode {
  return Row({
    width: '100%',
    gap: theme.spacing.sm,
    children: [
      statTile('JOGOS', String(stats.played), theme),
      statTile('VITÓRIAS', String(stats.wins), theme),
      statTile('% VIT.', String(stats.winRate), theme),
      statTile('SEQUÊNCIA', String(stats.currentStreak), theme),
      statTile('MELHOR', String(stats.bestStreak), theme),
    ],
  });
}

function sectionLabel(text: string, theme: Theme): CanvasNode {
  return Text(text, {
    fontFamily: RETRO_FONT,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    letterSpacing: 1,
  });
}

export function distributionBarWidth(count: number, max: number): number {
  if (count <= 0 || max <= 0) return DISTRIBUTION_BAR_MIN;
  return Math.max(
    DISTRIBUTION_BAR_MIN,
    Math.round((count / max) * DISTRIBUTION_BAR_MAX),
  );
}

function distribution(stats: WordlePlayerStats, theme: Theme): CanvasNode {
  const max = Math.max(...stats.distribution);
  const peak = max > 0 ? stats.distribution.indexOf(max) : -1;
  return Column({
    width: '100%',
    gap: theme.spacing.xs,
    children: [
      sectionLabel('DISTRIBUIÇÃO DE PALPITES', theme),
      ...stats.distribution.map((count, i) => {
        const colors = i === peak ? theme.colors.correct : theme.colors.absent;
        return Row({
          alignItems: Style.Align.Center,
          gap: theme.spacing.sm,
          children: [
            Box({
              width: 24,
              children: [
                Text(DISTRIBUTION_LABELS[i]!, {
                  fontFamily: theme.fontFamilies.heading,
                  fontWeight: 'bold',
                  fontSize: theme.fontSizes.md,
                  color: theme.colors.textPrimary,
                }),
              ],
            }),
            Row({
              width: distributionBarWidth(count, max),
              height: 20,
              backgroundColor: colors.bg,
              borderRadius: theme.radii.sm,
              justifyContent: Style.Justify.FlexEnd,
              alignItems: Style.Align.Center,
              padding: { Horizontal: theme.spacing.xs + 2 },
              children: [
                Text(String(count), {
                  fontFamily: theme.fontFamilies.heading,
                  fontWeight: 'bold',
                  fontSize: theme.fontSizes.md,
                  color: colors.text,
                }),
              ],
            }),
          ],
        });
      }),
    ],
  });
}

function familyRow(row: TermoAchievementsFamilyRow, theme: Theme): CanvasNode {
  const complete = row.total > 0 && row.unlocked === row.total;
  return Row({
    alignItems: Style.Align.Center,
    gap: theme.spacing.sm,
    children: [
      Box({
        width: ROW_LABEL_WIDTH,
        children: [
          Text(row.label, {
            fontFamily: theme.fontFamilies.body,
            fontWeight: '600',
            fontSize: theme.fontSizes.md,
            color: theme.colors.textPrimary,
          }),
        ],
      }),
      progressBar(
        row.unlocked,
        row.total,
        {
          width: FAMILY_BAR_WIDTH,
          label: `${row.unlocked}/${row.total}`,
          color: complete ? theme.colors.present.bg : theme.colors.accent,
          trackColor: theme.colors.card,
        },
        theme,
      ),
    ],
  });
}

function families(
  rows: TermoAchievementsFamilyRow[],
  theme: Theme,
): CanvasNode {
  return Column({
    width: '100%',
    gap: theme.spacing.sm,
    children: [
      sectionLabel('PROGRESSO POR CATEGORIA', theme),
      ...rows.map((row) => familyRow(row, theme)),
    ],
  });
}

export function termoAchievementsCard(
  input: TermoAchievementsCardInput,
  theme: Theme = defaultTheme,
): CanvasNode {
  return card(
    [
      header(input, theme),
      statsRow(input.stats, theme),
      distribution(input.stats, theme),
      families(input.families, theme),
    ],
    theme,
  );
}

export type TermoAchievementDetailInput = {
  displayName: string;
  achievement: WordleAchievementStatus;
};

function drawingGrid(
  rows: (LetterFeedback | null)[][],
  matchedCells: readonly [number, number][],
  theme: Theme,
): CanvasNode {
  const matched = new Set(matchedCells.map(([row, col]) => `${row},${col}`));
  return Column({
    gap: 4,
    children: rows.map((row, rowIndex) =>
      Row({
        gap: 4,
        children: row.map((feedback, colIndex) =>
          Box({
            width: 28,
            height: 28,
            backgroundColor:
              feedback === null ? theme.colors.card : theme.colors[feedback].bg,
            borderRadius: theme.radii.sm,
            border: matched.has(`${rowIndex},${colIndex}`) ? 2 : 0,
            borderColor: theme.colors.textPrimary,
            justifyContent: Style.Justify.Center,
            alignItems: Style.Align.Center,
            children:
              feedback === null
                ? [
                    Text('·', {
                      color: theme.colors.textMuted,
                      fontSize: theme.fontSizes.xl,
                      fontFamily: theme.fontFamilies.body,
                    }),
                  ]
                : [],
          }),
        ),
      }),
    ),
  });
}

export function termoAchievementDetailCard(
  input: TermoAchievementDetailInput,
  theme: Theme = defaultTheme,
): CanvasNode {
  const { achievement } = input;
  const children: CanvasNode[] = [
    sectionLabel('CONQUISTA', theme),
    Text(achievement.name, {
      fontFamily: theme.fontFamilies.heading,
      fontWeight: 'bold',
      fontSize: theme.fontSizes.xl,
      color: theme.colors.textPrimary,
    }),
    Text(truncate(input.displayName, 36), {
      fontFamily: theme.fontFamilies.body,
      fontSize: theme.fontSizes.md,
      color: theme.colors.textMuted,
    }),
  ];
  const evidence =
    achievement.unlockedAt === null
      ? null
      : (achievement.matchEvidence ?? null);
  if (evidence !== null) {
    children.push(
      sectionLabel(`DESCOBERTO EM ${evidence.date}`, theme),
      drawingGrid(evidence.feedback, evidence.cells, theme),
      Text('O contorno marca as células do desenho.', {
        fontFamily: theme.fontFamilies.body,
        fontSize: theme.fontSizes.md,
        color: theme.colors.textMuted,
      }),
    );
  } else if (achievement.patternPreview !== undefined) {
    const preview = achievement.patternPreview;
    children.push(
      sectionLabel('DESENHE EM UMA DAS CORES', theme),
      ...[preview.mask, ...(preview.variants ?? [])].map((mask) =>
        Row({
          gap: theme.spacing.lg,
          children: preview.colors.map((color) =>
            Column({
              gap: theme.spacing.sm,
              children: [
                labelText(color === 'correct' ? 'VERDE' : 'AMARELO', {}, theme),
                drawingGrid(
                  mask.map((row) =>
                    [...row].map((cell) => (cell === '#' ? color : null)),
                  ),
                  [],
                  theme,
                ),
              ],
            }),
          ),
        }),
      ),
      Text('Os pontos aceitam qualquer cor. Células extras são permitidas.', {
        fontFamily: theme.fontFamilies.body,
        fontSize: theme.fontSizes.md,
        color: theme.colors.textMuted,
      }),
    );
  }
  return card(children, theme);
}
