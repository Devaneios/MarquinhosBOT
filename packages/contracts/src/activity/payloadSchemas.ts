import { z } from 'zod';

export const gridCellSchema = z.object({
  row: z.number().int(),
  col: z.number().int(),
});

export type GridCell = z.infer<typeof gridCellSchema>;

const dominoPipsSchema = z.number().int().min(0).max(6);

export const dominoTileSchema = z.object({
  a: dominoPipsSchema,
  b: dominoPipsSchema,
});

export const chainEndSchema = z.enum(['left', 'right']);
