import { Box, Column, Row, Style, Text } from '@meonode/canvas';
import { defaultTheme, type Theme } from '../theme';
import type { CanvasNode } from '../types';

export function sectionHeader(
  title: string,
  badge?: string,
  theme: Theme = defaultTheme,
): CanvasNode {
  return Column({
    width: '100%',
    children: [
      Row({
        width: '100%',
        justifyContent: Style.Justify.SpaceBetween,
        alignItems: Style.Align.FlexEnd,
        children: [
          Text(title, {
            fontFamily: theme.fontFamilies.heading,
            fontWeight: 'bold',
            fontSize: theme.fontSizes.xl,
            color: theme.colors.textPrimary,
          }),
          ...(badge !== undefined
            ? [
                Text(badge, {
                  fontFamily: theme.fontFamilies.body,
                  fontWeight: '500',
                  fontSize: theme.fontSizes.md,
                  color: theme.colors.accent,
                  letterSpacing: 2,
                }),
              ]
            : []),
        ],
      }),
      Box({
        width: '100%',
        height: 1,
        backgroundColor: '#353436',
        marginTop: theme.spacing.sm,
      }),
    ],
  });
}
