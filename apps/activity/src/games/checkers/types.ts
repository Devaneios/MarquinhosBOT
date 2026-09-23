import { z } from 'zod';

export type GameMode = 'single' | 'multi';

const colorSchema = z.enum(['black', 'red']);
export type Color = z.infer<typeof colorSchema>;

const positionSchema = z.object({ row: z.number(), col: z.number() });
export type Position = z.infer<typeof positionSchema>;

const pieceSchema = z.object({ color: colorSchema, king: z.boolean() });
export type Piece = z.infer<typeof pieceSchema>;

export type Board = (Piece | null)[][];

export const checkersStateSchema = z.object({
  board: z.array(z.array(pieceSchema.nullable())),
  turn: colorSchema,
  winner: colorSchema.nullable(),
  mustContinueFrom: positionSchema.nullable(),
});

export type CheckersState = z.infer<typeof checkersStateSchema>;

export const initPayloadSchema = z.object({
  color: colorSchema.nullable(),
  state: checkersStateSchema,
});
