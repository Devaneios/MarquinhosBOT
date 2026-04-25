import { Row, Style } from '@meonode/canvas';
import { defaultTheme, type Theme } from '../../theme';
import type { CanvasNode } from '../../types';
import { attemptTile, emptyTile } from './tiles';

export function wordPreview(
  word: string | undefined,
  wordLength: number,
  reveal: boolean,
  theme: Theme = defaultTheme,
): CanvasNode {
  return Row({
    justifyContent: Style.Justify.Center,
    gap: 4,
    children:
      reveal && word !== undefined
        ? word.split('').map((letter) => attemptTile('correct', letter, theme))
        : Array.from({ length: wordLength }, () => emptyTile(theme)),
  });
}
