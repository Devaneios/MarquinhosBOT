import { z } from 'zod';

export const gridCellSchema = z.object({
  row: z.number().int(),
  col: z.number().int(),
});

export type GridCell = z.infer<typeof gridCellSchema>;
