import { Text } from '@meonode/canvas';
import { badge, card, panel, sectionHeader } from '../../primitives';
import { defaultTheme, type Theme } from '../../theme';
import type { CanvasNode } from '../../types';

export function termoNoticeCard(
  title: string,
  body: string,
  options?: { badge?: string },
  theme: Theme = defaultTheme,
): CanvasNode {
  return card(
    [
      sectionHeader(title, options?.badge, theme),
      panel(
        [
          Text(body, {
            fontFamily: theme.fontFamilies.body,
            fontWeight: '500',
            fontSize: theme.fontSizes.md,
            color: theme.colors.textPrimary,
          }),
        ],
        { padding: theme.spacing.md, gap: theme.spacing.sm },
        theme,
      ),
      badge(
        'TERMINHOS',
        { bg: theme.colors.correct.bg, color: theme.colors.correct.text },
        theme,
      ),
    ],
    theme,
  );
}
