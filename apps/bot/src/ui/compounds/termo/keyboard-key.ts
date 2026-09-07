import { Box, Style, Text } from '@meonode/canvas';
import { defaultTheme, type Theme } from '../../theme';
import type { CanvasNode } from '../../types';
import type { LetterFeedback } from './letter-states';

export function keyboardKey(
  letter: string,
  state: LetterFeedback | 'unused',
  theme: Theme = defaultTheme,
): CanvasNode {
  const colors = theme.colors[state];
  return Box({
    width: 28,
    height: 32,
    backgroundColor: colors.side,
    borderRadius: 5,
    justifyContent: Style.Justify.FlexStart,
    alignItems: Style.Align.Center,
    boxShadow: {
      offsetX: 0,
      offsetY: 2,
      blur: 3,
      color: 'rgba(0, 0, 0, 0.4)',
    },
    children: [
      Box({
        width: 24,
        height: 28,
        gradient: {
          type: 'linear' as const,
          colors: [colors.highlight, colors.bg],
          direction: 'to-bottom' as const,
        },
        borderRadius: 4,
        justifyContent: Style.Justify.Center,
        alignItems: Style.Align.Center,
        boxShadow: [
          {
            inset: true,
            offsetX: 0,
            offsetY: 1,
            blur: 0,
            color: 'rgba(255, 255, 255, 0.15)',
          },
          {
            inset: true,
            offsetX: 0,
            offsetY: -1,
            blur: 0,
            color: 'rgba(0, 0, 0, 0.2)',
          },
        ],
        children: [
          Text(letter.toUpperCase(), {
            fontFamily: theme.fontFamilies.body,
            fontWeight: '600',
            fontSize: theme.fontSizes.sm,
            color: colors.text,
          }),
        ],
      }),
    ],
  });
}
