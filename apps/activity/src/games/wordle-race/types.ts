import { z } from 'zod';

const letterFeedbackSchema = z.enum(['correct', 'present', 'absent']);
export type LetterFeedback = z.infer<typeof letterFeedbackSchema>;

const guessRowSchema = z.object({
  guess: z.string(),
  feedback: z.array(letterFeedbackSchema),
});
export type GuessRow = z.infer<typeof guessRowSchema>;

export const gameStateSchema = z.object({
  targetWordLength: z.number(),
  maxAttempts: z.number(),
  players: z.array(
    z.object({
      userId: z.string(),
      attempts: z.number(),
      solved: z.boolean(),
      exhausted: z.boolean(),
      guesses: z.array(guessRowSchema),
    }),
  ),
  firstSolver: z.string().nullable(),
  gameOver: z.boolean(),
  currentPlayerGuesses: z.array(guessRowSchema),
  currentPlayerSolved: z.boolean(),
  currentPlayerExhausted: z.boolean(),
});

export type GameState = z.infer<typeof gameStateSchema>;

export const guessSubmittedPayloadSchema = z.object({
  userId: z.string(),
  guess: z.string(),
  feedback: z.array(letterFeedbackSchema),
  attempts: z.number(),
  solved: z.boolean(),
});

export const actionRejectedPayloadSchema = z.object({ error: z.string() });

export const playerSolvedPayloadSchema = z.object({
  userId: z.string(),
  firstSolver: z.boolean(),
});

export const playerExhaustedPayloadSchema = z.object({ userId: z.string() });
