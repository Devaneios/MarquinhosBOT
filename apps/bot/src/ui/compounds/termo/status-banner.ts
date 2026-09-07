import { Row, Style, Text } from '@meonode/canvas';
import { badge, panel } from '../../primitives';
import { defaultTheme, type Theme } from '../../theme';
import type { CanvasNode } from '../../types';
import type { TermoSolvedStatus } from './types';

export function solvedStatusBanner(
  status: TermoSolvedStatus,
  theme: Theme = defaultTheme,
): CanvasNode {
  const attemptsLabel = status.attempts === 1 ? 'tentativa' : 'tentativas';

  return panel(
    [
      Row({
        width: '100%',
        justifyContent: Style.Justify.SpaceBetween,
        alignItems: Style.Align.Center,
        gap: theme.spacing.sm,
        children: [
          Text(`Acertou em ${status.attempts} ${attemptsLabel}.`, {
            fontFamily: theme.fontFamilies.body,
            fontWeight: '600',
            fontSize: theme.fontSizes.md,
            color: theme.colors.textPrimary,
          }),
          badge(
            'RESOLVIDO',
            { bg: theme.colors.correct.bg, color: theme.colors.correct.text },
            theme,
          ),
        ],
      }),
    ],
    { padding: theme.spacing.md, gap: theme.spacing.sm },
    theme,
  );
}
