import { Box } from '@meonode/canvas';
import type { CanvasNode } from '../types';

export function spacer(size: number): CanvasNode {
  return Box({ width: size, height: size });
}
