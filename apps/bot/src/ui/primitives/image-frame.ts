import { Image } from '@meonode/canvas';
import { defaultTheme, type Theme } from '../theme';
import type { CanvasNode } from '../types';

export type ImageFrameOptions = {
  width: number;
  height: number;
  radius?: number;
};

export function imageFrame(
  imageBuffer: Buffer,
  options: ImageFrameOptions,
  theme: Theme = defaultTheme,
): CanvasNode {
  return Image({
    src: imageBuffer,
    width: options.width,
    height: options.height,
    borderRadius: options.radius ?? theme.radii.md,
    objectFit: 'cover',
  });
}
