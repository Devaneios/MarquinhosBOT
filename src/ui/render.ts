import { resourcePath } from '@marquinhos/utils/resources';
import { Root } from '@meonode/canvas';
import type { CanvasNode } from './types';

const FONT_DIR = resourcePath('fonts');

const FONTS = [
  { family: 'Space Grotesk', paths: [`${FONT_DIR}/SpaceGrotesk.ttf`] },
  { family: 'Inter', paths: [`${FONT_DIR}/Inter.ttf`] },
  { family: 'Press Start 2P', paths: [`${FONT_DIR}/PressStart2P.ttf`] },
];

export type RenderOptions = {
  width?: number;
  scale?: number;
  workerMode?: boolean;
};

export async function render(
  children: CanvasNode[],
  options?: RenderOptions,
): Promise<Buffer> {
  const canvas = await Root({
    width: options?.width ?? 360,
    scale: options?.scale ?? 1,
    workerMode: options?.workerMode ?? true,
    fonts: FONTS,
    children,
  });
  const canvasBuffer = await canvas.toBuffer('png');
  const buffer = Buffer.from(canvasBuffer);
  if (typeof canvas.release === 'function') {
    canvas.release();
  }
  return buffer;
}
