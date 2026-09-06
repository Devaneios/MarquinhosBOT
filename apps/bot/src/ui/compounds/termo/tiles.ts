import { Box, Style, Text } from '@meonode/canvas';
import { defaultTheme, type Theme } from '../../theme';
import type { CanvasNode } from '../../types';
import type { LetterFeedback } from './letter-states';

export function attemptTile(
  feedback: LetterFeedback,
  letter?: string,
  theme: Theme = defaultTheme,
): CanvasNode {
  const colors = theme.colors[feedback];
  return Box({
    width: 32,
    height: 32,
    backgroundColor: colors.bg,
    borderRadius: theme.radii.sm,
    justifyContent: Style.Justify.Center,
    alignItems: Style.Align.Center,
    ...(letter !== undefined
      ? {
          children: [
            Text(letter.toUpperCase(), {
              fontFamily: theme.fontFamilies.heading,
              fontWeight: 'bold',
              fontSize: theme.fontSizes.lg,
              color: colors.text,
            }),
          ],
        }
      : {}),
  });
}

export function emptyTile(theme: Theme = defaultTheme): CanvasNode {
  return Box({
    width: 32,
    height: 32,
    borderRadius: theme.radii.sm / 2,
    border: 1,
    borderColor: 'rgba(65,73,62,0.2)',
  });
}

export function resultTile(
  feedback: LetterFeedback,
  theme: Theme = defaultTheme,
): CanvasNode {
  const colors = theme.colors[feedback];
  return Box({
    width: 32,
    height: 32,
    backgroundColor: colors.bg,
    borderRadius: 5,
  });
}
