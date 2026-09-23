import { z } from 'zod';
import {
  actionRejectedMessageSchema,
  leaveMessageSchema,
  restartMessageSchema,
  restartStatusMessageSchema,
} from '../protocol';

export const playerSchema = z.enum(['X', 'O']);
export type Player = z.output<typeof playerSchema>;
export type CellValue = Player | null;

export const ticTacToeStateSchema = z.object({
  board: z.array(z.array(playerSchema.nullable())),
  currentPlayer: playerSchema,
  winner: playerSchema.nullable(),
  isDraw: z.boolean(),
  moveCount: z.number(),
});
export type TicTacToeState = z.output<typeof ticTacToeStateSchema>;

export const movePayloadSchema = z.object({
  row: z.number().int(),
  col: z.number().int(),
});

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('move'), payload: movePayloadSchema }),
  restartMessageSchema,
  leaveMessageSchema,
]);
export type TicTacToeClientMessage = z.output<typeof clientMessageSchema>;

export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('init'),
    payload: z.object({
      player: playerSchema.nullable(),
      state: ticTacToeStateSchema,
    }),
  }),
  z.object({ type: z.literal('state_update'), payload: ticTacToeStateSchema }),
  z.object({
    type: z.literal('game_ready'),
    payload: z.object({ state: ticTacToeStateSchema }),
  }),
  z.object({
    type: z.literal('opponent_disconnected'),
    payload: z.object({ player: playerSchema, timeoutMs: z.number() }),
  }),
  z.object({
    type: z.literal('opponent_reconnected'),
    payload: z.object({ player: playerSchema }),
  }),
  restartStatusMessageSchema,
  actionRejectedMessageSchema,
]);
export type TicTacToeServerMessage = z.output<typeof serverMessageSchema>;
