import { z } from 'zod';
import { leaveMessageSchema } from '../protocol';

export const bingoCardSchema = z.object({
  board: z.array(z.array(z.number())),
  marked: z.array(z.array(z.boolean())),
});
export type BingoCard = z.output<typeof bingoCardSchema>;

export const bingoSpeedStateSchema = z.object({
  playerCount: z.number(),
  drawnNumbers: z.array(z.number()),
  gameStarted: z.boolean(),
  winner: z.string().nullable(),
});
export type BingoSpeedState = z.output<typeof bingoSpeedStateSchema>;

export const claimResultSchema = z.union([
  z.object({ success: z.literal(true) }),
  z.object({ error: z.string() }),
]);
export type BingoClaimResult = z.output<typeof claimResultSchema>;

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('claim_bingo') }),
  leaveMessageSchema,
]);
export type BingoSpeedClientMessage = z.output<typeof clientMessageSchema>;

export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('init'),
    payload: z.object({
      card: bingoCardSchema.nullable(),
      state: bingoSpeedStateSchema,
    }),
  }),
  z.object({ type: z.literal('game_started'), payload: z.object({}) }),
  z.object({
    type: z.literal('number_drawn'),
    payload: z.object({ number: z.number() }),
  }),
  z.object({
    type: z.literal('game_end'),
    payload: z.object({ winner: z.string() }),
  }),
  z.object({
    type: z.literal('bingo_claim_result'),
    payload: claimResultSchema,
  }),
  z.object({
    type: z.literal('opponent_disconnected'),
    payload: z.object({ userId: z.string(), timeoutMs: z.number() }),
  }),
  z.object({
    type: z.literal('opponent_reconnected'),
    payload: z.object({ userId: z.string() }),
  }),
]);
export type BingoSpeedServerMessage = z.output<typeof serverMessageSchema>;
