import { z } from 'zod';

const rpsPickSchema = z.enum(['rock', 'paper', 'scissors']);
export type RpsPick = z.infer<typeof rpsPickSchema>;

export const roundResultSchema = z.object({
  round: z.number(),
  p1Pick: rpsPickSchema,
  p2Pick: rpsPickSchema,
  winner: z.string().nullable(),
});

export type RoundResult = z.infer<typeof roundResultSchema>;

export const rpsStateSchema = z.object({
  round: z.number(),
  bestOf: z.number(),
  submitted: z.array(z.string()),
  scores: z.object({
    player1: z.number(),
    player2: z.number(),
  }),
});

export type RpsState = z.infer<typeof rpsStateSchema>;

export type GamePhase = 'waiting' | 'playing' | 'round_result' | 'match_end';

const rpsPlayerIdSchema = z.enum(['player1', 'player2']);
export type RpsPlayerId = z.infer<typeof rpsPlayerIdSchema>;

export const initPayloadSchema = z.object({
  playerId: rpsPlayerIdSchema.nullable(),
});

export const rpsErrorPayloadSchema = z.object({ message: z.string() });
