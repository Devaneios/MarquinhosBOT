import { Column } from '@meonode/canvas';
import { defaultTheme, type Theme } from '../theme';
import type { CanvasNode } from '../types';

export function card(
  children: CanvasNode[],
  theme: Theme = defaultTheme,
): CanvasNode {
  return Column({
    width: '100%',
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radii.lg,
    boxShadow: { blur: 24, color: 'rgba(0,0,0,0.5)' },
    border: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    children,
  });
}
