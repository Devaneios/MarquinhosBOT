import { resourcePath } from '@marquinhos/utils/resources';
import { Root } from '@meonode/canvas';
import type { CanvasNode } from './types';

const FONT_DIR = resourcePath('fonts');

const FONTS = [
  { family: 'Space Grotesk', paths: [`${FONT_DIR}/SpaceGrotesk.ttf`] },
  { family: 'Inter', paths: [`${FONT_DIR}/Inter.ttf`] },
];

export type RenderOptions = {
  width?: number;
  scale?: number;
};

export async function render(
  children: CanvasNode[],
  options?: RenderOptions,
): Promise<Buffer> {
  const canvas = await Root({
    width: options?.width ?? 360,
    scale: options?.scale ?? 2,
    workerMode: false,
    fonts: FONTS,
    children,
  });
  const buffer = Buffer.from(canvas.toBufferSync());
  if (typeof canvas.release === 'function') {
    canvas.release();
  }
  return buffer;
}
