import { Box } from '@meonode/canvas';
import { defaultTheme, type Theme } from '../theme';
import type { CanvasNode } from '../types';

export type DividerOptions = {
  color?: string;
  marginTop?: number;
};

export function divider(
  options?: DividerOptions,
  _theme: Theme = defaultTheme,
): CanvasNode {
  return Box({
    width: '100%',
    height: 1,
    backgroundColor: options?.color ?? '#353436',
    marginTop: options?.marginTop ?? 0,
  });
}
