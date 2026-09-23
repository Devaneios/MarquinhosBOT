import { z } from 'zod';

export type GameMode = 'single' | 'multi';

export const ticTacToeStateSchema = z.object({
  board: z.array(z.array(z.string().nullable())),
  currentPlayer: z.string(),
  winner: z.string().nullable(),
  isDraw: z.boolean(),
  moveCount: z.number(),
});

export type TicTacToeState = z.infer<typeof ticTacToeStateSchema>;

export const initPayloadSchema = z.object({
  player: z.string().nullable(),
  state: ticTacToeStateSchema,
});

export const actionRejectedPayloadSchema = z.object({ error: z.string() });
