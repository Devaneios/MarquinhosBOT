import { Image } from '@meonode/canvas';
import { defaultTheme, type Theme } from '../theme';
import type { CanvasNode } from '../types';

export function avatar(
  imageBuffer: Buffer,
  size: number = 48,
  theme: Theme = defaultTheme,
): CanvasNode {
  void theme;
  return Image({
    src: imageBuffer,
    width: size,
    height: size,
    borderRadius: size / 2,
    objectFit: 'cover',
  });
}
