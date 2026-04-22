import { Text } from '@meonode/canvas';
import { defaultTheme, type Theme } from '../theme';
import type { CanvasNode } from '../types';

export type LabelTextOptions = {
  letterSpacing?: number;
  size?: keyof Theme['fontSizes'];
};

export function labelText(
  content: string,
  options?: LabelTextOptions,
  theme: Theme = defaultTheme,
): CanvasNode {
  return Text(content, {
    fontFamily: theme.fontFamilies.body,
    fontWeight: '500',
    fontSize: theme.fontSizes[options?.size ?? 'xs'],
    color: theme.colors.textMuted,
    ...(options?.letterSpacing !== undefined
      ? { letterSpacing: options.letterSpacing }
      : {}),
  });
}
