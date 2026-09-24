import { z } from 'zod';
import {
  leaveMessageSchema,
  restartMessageSchema,
  restartStatusMessageSchema,
} from '../protocol';

const dominoPipsSchema = z.number().int().min(0).max(6);

export const dominoTileSchema = z.object({
  a: dominoPipsSchema,
  b: dominoPipsSchema,
});
export type Tile = z.output<typeof dominoTileSchema>;

export const chainEndSchema = z.enum(['left', 'right']);
export type ChainEnd = z.output<typeof chainEndSchema>;

export const dominoesClientStateSchema = z.object({
  players: z.array(z.string()),
  handCounts: z.record(z.string(), z.number()),
  hand: z.array(dominoTileSchema).nullable(),
  boneyard: z.number(),
  chain: z.array(dominoTileSchema),
  leftEnd: z.number().nullable(),
  rightEnd: z.number().nullable(),
  currentPlayer: z.string().nullable(),
  winner: z.string().nullable(),
  winners: z.array(z.string()).nullable(),
  blocked: z.boolean(),
  pipTotals: z.record(z.string(), z.number()).nullable(),
});
export type DominoesClientState = z.output<typeof dominoesClientStateSchema>;

export const playPayloadSchema = z.object({
  tile: dominoTileSchema,
  end: chainEndSchema.optional(),
});

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('play'), payload: playPayloadSchema }),
  z.object({ type: z.literal('pass') }),
  restartMessageSchema,
  leaveMessageSchema,
]);
export type DominoesClientMessage = z.output<typeof clientMessageSchema>;

export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('state'), payload: dominoesClientStateSchema }),
  z.object({
    type: z.literal('move_rejected'),
    payload: z.object({ reason: z.string() }),
  }),
  z.object({
    type: z.literal('match_over'),
    payload: z.object({
      winner: z.string().nullable(),
      winners: z.array(z.string()).nullable(),
      blocked: z.boolean(),
      abandoned: z.literal(true).optional(),
    }),
  }),
  restartStatusMessageSchema,
  z.object({
    type: z.literal('opponent_disconnected'),
    payload: z.object({ userId: z.string(), timeoutMs: z.number() }),
  }),
  z.object({
    type: z.literal('opponent_reconnected'),
    payload: z.object({ userId: z.string() }),
  }),
]);
export type DominoesServerMessage = z.output<typeof serverMessageSchema>;
