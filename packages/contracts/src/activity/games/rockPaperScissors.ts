import { z } from 'zod';
import { leaveMessageSchema } from '../protocol';

export const rpsPickSchema = z.enum(['rock', 'paper', 'scissors']);
export type RpsPick = z.output<typeof rpsPickSchema>;

export const rpsPlayerIdSchema = z.enum(['player1', 'player2']);
export type RpsPlayerId = z.output<typeof rpsPlayerIdSchema>;

export const roundResultSchema = z.object({
  round: z.number(),
  p1Pick: rpsPickSchema,
  p2Pick: rpsPickSchema,
  winner: rpsPlayerIdSchema.nullable(),
});
export type RoundResult = z.output<typeof roundResultSchema>;

export const rpsRoundStateSchema = z.object({
  round: z.number(),
  bestOf: z.number(),
  submitted: z.array(rpsPlayerIdSchema),
  scores: z.object({ player1: z.number(), player2: z.number() }),
});
export type RpsRoundState = z.output<typeof rpsRoundStateSchema>;

export const pickPayloadSchema = z.object({ pick: z.string() });

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('pick'),
    payload: z.object({ pick: rpsPickSchema }),
  }),
  leaveMessageSchema,
]);
export type RpsClientMessage = z.output<typeof clientMessageSchema>;

export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('init'),
    payload: z.object({
      playerId: rpsPlayerIdSchema.nullable(),
      config: z.object({ bestOf: z.number() }),
    }),
  }),
  z.object({ type: z.literal('game_start'), payload: z.object({}) }),
  z.object({ type: z.literal('round_state'), payload: rpsRoundStateSchema }),
  z.object({ type: z.literal('round_result'), payload: roundResultSchema }),
  z.object({
    type: z.literal('match_end'),
    payload: z.object({
      winner: z.string().nullable(),
      history: z.array(roundResultSchema),
    }),
  }),
  z.object({
    type: z.literal('opponent_disconnected'),
    payload: z.object({ player: rpsPlayerIdSchema, timeoutMs: z.number() }),
  }),
  z.object({
    type: z.literal('error'),
    payload: z.object({ message: z.string() }),
  }),
]);
export type RpsServerMessage = z.output<typeof serverMessageSchema>;
