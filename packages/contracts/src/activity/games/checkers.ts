import { z } from 'zod';
import { gridCellSchema } from '../payloadSchemas';
import {
  actionRejectedMessageSchema,
  leaveMessageSchema,
  restartMessageSchema,
  restartStatusMessageSchema,
} from '../protocol';

export const colorSchema = z.enum(['black', 'red']);
export type Color = z.output<typeof colorSchema>;

export type Position = z.output<typeof gridCellSchema>;

export const pieceSchema = z.object({ color: colorSchema, king: z.boolean() });
export type Piece = z.output<typeof pieceSchema>;

export const checkersStateSchema = z.object({
  board: z.array(z.array(pieceSchema.nullable())),
  turn: colorSchema,
  winner: colorSchema.nullable(),
  mustContinueFrom: gridCellSchema.nullable(),
});
export type CheckersState = z.output<typeof checkersStateSchema>;
export type Board = CheckersState['board'];

export const movePayloadSchema = z.object({
  from: gridCellSchema,
  to: gridCellSchema,
});

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('move'), payload: movePayloadSchema }),
  restartMessageSchema,
  leaveMessageSchema,
]);
export type CheckersClientMessage = z.output<typeof clientMessageSchema>;

export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('init'),
    payload: z.object({
      color: colorSchema.nullable(),
      state: checkersStateSchema,
    }),
  }),
  z.object({ type: z.literal('state'), payload: checkersStateSchema }),
  z.object({
    type: z.literal('opponent_disconnected'),
    payload: z.object({ color: colorSchema, timeoutMs: z.number() }),
  }),
  z.object({
    type: z.literal('opponent_reconnected'),
    payload: z.object({ color: colorSchema }),
  }),
  restartStatusMessageSchema,
  actionRejectedMessageSchema,
]);
export type CheckersServerMessage = z.output<typeof serverMessageSchema>;
