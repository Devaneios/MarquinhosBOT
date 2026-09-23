import { z } from 'zod';

export type GameMode = 'single' | 'multi';

export const discSchema = z.enum(['p1', 'p2']);
export type Disc = z.infer<typeof discSchema>;

export const connectFourStateSchema = z.object({
  grid: z.array(z.array(discSchema.nullable())),
  currentTurn: discSchema,
  winner: discSchema.nullable(),
  winningLine: z
    .array(z.object({ row: z.number(), col: z.number() }))
    .nullable(),
  isDraw: z.boolean(),
});

export type ConnectFourState = z.infer<typeof connectFourStateSchema>;

export const initPayloadSchema = z.object({
  disc: discSchema.nullable(),
  state: connectFourStateSchema,
});
