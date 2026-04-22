import { Box, Text } from '@meonode/canvas';
import { defaultTheme, type Theme } from '../theme';
import type { CanvasNode } from '../types';

export type TagOptions = {
  color?: string;
  bg?: string;
};

export function tag(
  text: string,
  options?: TagOptions,
  theme: Theme = defaultTheme,
): CanvasNode {
  const content = Text(text, {
    fontFamily: theme.fontFamilies.body,
    fontWeight: '600',
    fontSize: theme.fontSizes.xs,
    color: options?.color ?? theme.colors.accent,
    letterSpacing: 1,
  });
  if (options?.bg === undefined) return content;
  return Box({
    backgroundColor: options.bg,
    borderRadius: theme.radii.sm,
    padding: { Horizontal: theme.spacing.xs, Vertical: theme.spacing.xs },
    children: [content],
  });
}
