import { z } from 'zod';
import { leaveMessageSchema } from '../protocol';

export const playerScoreSchema = z.object({
  userId: z.string(),
  score: z.number(),
});
export type PlayerScore = z.output<typeof playerScoreSchema>;

export const triviaQuestionStateSchema = z.object({
  currentQuestionIndex: z.number(),
  questionText: z.string(),
  options: z.array(z.string()),
  questionStartedAtMs: z.number(),
  questionTimerMs: z.number(),
  playerScores: z.array(playerScoreSchema),
  finished: z.boolean(),
});
export type TriviaQuestionState = z.output<typeof triviaQuestionStateSchema>;

export const answerPayloadSchema = z.object({
  answerIndex: z.number().int().min(0),
});

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('answer'), payload: answerPayloadSchema }),
  leaveMessageSchema,
]);
export type TriviaQuizClientMessage = z.output<typeof clientMessageSchema>;

export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('init'),
    payload: z.object({
      playerScores: z.array(playerScoreSchema),
      leaderboard: z.array(playerScoreSchema),
    }),
  }),
  z.object({
    type: z.literal('state_update'),
    payload: triviaQuestionStateSchema,
  }),
  z.object({
    type: z.literal('game_end'),
    payload: z.object({ leaderboard: z.array(playerScoreSchema) }),
  }),
  z.object({
    type: z.literal('error'),
    payload: z.object({ message: z.string() }),
  }),
]);
export type TriviaQuizServerMessage = z.output<typeof serverMessageSchema>;
