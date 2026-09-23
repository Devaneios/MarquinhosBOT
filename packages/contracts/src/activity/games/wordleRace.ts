import { z } from 'zod';
import { guessRowSchema, letterFeedbackSchema } from '../../wordle';
import { actionRejectedMessageSchema, leaveMessageSchema } from '../protocol';

export const wordleRacePlayerSchema = z.object({
  userId: z.string(),
  attempts: z.number(),
  solved: z.boolean(),
  exhausted: z.boolean(),
  guesses: z.array(guessRowSchema),
});

export const wordleRaceStateSchema = z.object({
  targetWordLength: z.number(),
  maxAttempts: z.number(),
  players: z.array(wordleRacePlayerSchema),
  firstSolver: z.string().nullable(),
  gameOver: z.boolean(),
  currentPlayerGuesses: z.array(guessRowSchema),
  currentPlayerSolved: z.boolean(),
  currentPlayerExhausted: z.boolean(),
});
export type WordleRaceState = z.output<typeof wordleRaceStateSchema>;

export const guessPayloadSchema = z.object({ guess: z.string().default('') });

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('guess'), payload: guessPayloadSchema }),
  leaveMessageSchema,
]);
export type WordleRaceClientMessage = z.input<typeof clientMessageSchema>;

export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('init'), payload: wordleRaceStateSchema }),
  z.object({
    type: z.literal('guess_submitted'),
    payload: z.object({
      userId: z.string(),
      guess: z.string(),
      feedback: z.array(letterFeedbackSchema),
      attempts: z.number(),
      solved: z.boolean(),
    }),
  }),
  z.object({
    type: z.literal('player_solved'),
    payload: z.object({ userId: z.string(), firstSolver: z.boolean() }),
  }),
  z.object({
    type: z.literal('player_exhausted'),
    payload: z.object({ userId: z.string() }),
  }),
  z.object({
    type: z.literal('player_joined'),
    payload: z.object({
      userId: z.string(),
      targetWordLength: z.number(),
      maxAttempts: z.number(),
      totalPlayers: z.number(),
    }),
  }),
  z.object({
    type: z.literal('player_left'),
    payload: z.object({ userId: z.string() }),
  }),
  z.object({
    type: z.literal('game_ended'),
    payload: z.object({
      targetWord: z.string(),
      results: z.array(
        z.object({
          userId: z.string(),
          position: z.number(),
          solved: z.boolean(),
        }),
      ),
    }),
  }),
  actionRejectedMessageSchema,
]);
export type WordleRaceServerMessage = z.output<typeof serverMessageSchema>;
