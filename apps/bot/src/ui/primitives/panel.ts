import { Column } from '@meonode/canvas';
import { defaultTheme, type Theme } from '../theme';
import type { CanvasNode } from '../types';

export type PanelOptions = {
  padding?: number;
  gap?: number;
};

export function panel(
  children: CanvasNode[],
  options?: PanelOptions,
  theme: Theme = defaultTheme,
): CanvasNode {
  return Column({
    width: '100%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: options?.padding,
    gap: options?.gap,
    children,
  });
}
