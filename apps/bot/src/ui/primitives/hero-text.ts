import { Text } from '@meonode/canvas';
import { defaultTheme, type Theme } from '../theme';
import type { CanvasNode } from '../types';

export type HeroTextOptions = {
  size?: keyof Theme['fontSizes'];
  color?: string;
};

export function heroText(
  text: string,
  options?: HeroTextOptions,
  theme: Theme = defaultTheme,
): CanvasNode {
  return Text(text, {
    fontFamily: theme.fontFamilies.heading,
    fontWeight: 'bold',
    fontSize: theme.fontSizes[options?.size ?? 'display'],
    color: options?.color ?? theme.colors.textPrimary,
  });
}
