import { Box, Row, Style, Text } from '@meonode/canvas';
import { defaultTheme, type Theme } from '../theme';
import type { CanvasNode } from '../types';

export type ProgressBarOptions = {
  width?: number;
  label?: string;
  color?: string;
};

export function progressBar(
  value: number,
  max: number,
  options?: ProgressBarOptions,
  theme: Theme = defaultTheme,
): CanvasNode {
  const clamped = Math.max(0, Math.min(1, max === 0 ? 0 : value / max));
  const fillColor = options?.color ?? theme.colors.accent;
  const width = options?.width ?? 200;
  const height = 8;

  return Row({
    alignItems: Style.Align.Center,
    gap: theme.spacing.sm,
    children: [
      Box({
        width,
        height,
        backgroundColor: theme.colors.surface,
        borderRadius: height / 2,
        children: [
          Box({
            width: Math.round(width * clamped),
            height,
            backgroundColor: fillColor,
            borderRadius: height / 2,
          }),
        ],
      }),
      ...(options?.label !== undefined
        ? [
            Text(options.label, {
              fontFamily: theme.fontFamilies.body,
              fontWeight: '500',
              fontSize: theme.fontSizes.sm,
              color: theme.colors.textMuted,
            }),
          ]
        : []),
    ],
  });
}
