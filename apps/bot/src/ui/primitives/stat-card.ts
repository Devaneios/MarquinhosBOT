import { Box, Column, Style, Text } from '@meonode/canvas';
import { defaultTheme, type Theme } from '../theme';
import type { CanvasNode } from '../types';
import { labelText } from './label-text';

export function statCard(
  label: string,
  value: string | number,
  theme: Theme = defaultTheme,
): CanvasNode {
  return Box({
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    width: '100%',
    children: [
      Column({
        alignItems: Style.Align.Center,
        gap: theme.spacing.xs,
        children: [
          labelText(label, { letterSpacing: 1.5 }, theme),
          Text(String(value), {
            fontFamily: theme.fontFamilies.heading,
            fontWeight: 'bold',
            fontSize: theme.fontSizes.display,
            color: '#e5e2e3',
          }),
        ],
      }),
    ],
  });
}
