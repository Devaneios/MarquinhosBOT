import { z } from 'zod';
import { gridCellSchema } from '../payloadSchemas';
import {
  leaveMessageSchema,
  restartMessageSchema,
  restartStatusMessageSchema,
} from '../protocol';

export const discSchema = z.enum(['p1', 'p2']);
export type Disc = z.output<typeof discSchema>;

export const connectFourStateSchema = z.object({
  grid: z.array(z.array(discSchema.nullable())),
  currentTurn: discSchema,
  winner: discSchema.nullable(),
  winningLine: z.array(gridCellSchema).nullable(),
  isDraw: z.boolean(),
});
export type ConnectFourState = z.output<typeof connectFourStateSchema>;

export const dropPayloadSchema = z.object({ col: z.number().int() });

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('drop'), payload: dropPayloadSchema }),
  restartMessageSchema,
  leaveMessageSchema,
]);
export type ConnectFourClientMessage = z.output<typeof clientMessageSchema>;

export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('init'),
    payload: z.object({
      disc: discSchema.nullable(),
      state: connectFourStateSchema,
    }),
  }),
  z.object({ type: z.literal('state'), payload: connectFourStateSchema }),
  z.object({
    type: z.literal('move_rejected'),
    payload: z.object({ col: z.number().optional() }),
  }),
  z.object({
    type: z.literal('opponent_disconnected'),
    payload: z.object({ disc: discSchema, timeoutMs: z.number() }),
  }),
  z.object({
    type: z.literal('opponent_reconnected'),
    payload: z.object({ disc: discSchema }),
  }),
  restartStatusMessageSchema,
]);
export type ConnectFourServerMessage = z.output<typeof serverMessageSchema>;
