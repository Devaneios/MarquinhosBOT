import { Box, Text } from '@meonode/canvas';
import { defaultTheme, type Theme } from '../theme';
import type { CanvasNode } from '../types';

export type BadgeOptions = {
  color?: string;
  bg?: string;
};

export function badge(
  text: string,
  options?: BadgeOptions,
  theme: Theme = defaultTheme,
): CanvasNode {
  return Box({
    backgroundColor: options?.bg ?? theme.colors.card,
    borderRadius: theme.radii.sm,
    padding: { Horizontal: theme.spacing.sm, Vertical: theme.spacing.xs },
    children: [
      Text(text, {
        fontFamily: theme.fontFamilies.body,
        fontWeight: '600',
        fontSize: theme.fontSizes.xs,
        color: options?.color ?? theme.colors.accent,
        letterSpacing: 1,
      }),
    ],
  });
}
