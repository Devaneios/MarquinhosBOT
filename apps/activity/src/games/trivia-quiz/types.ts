import { z } from 'zod';

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  category: string;
}

const playerScoreSchema = z.object({ userId: z.string(), score: z.number() });

export type PlayerScore = z.infer<typeof playerScoreSchema>;

export const initPayloadSchema = z.object({
  playerScores: z.array(playerScoreSchema),
});

export const stateUpdatePayloadSchema = z.object({
  currentQuestionIndex: z.number(),
  questionText: z.string(),
  options: z.array(z.string()),
  questionStartedAtMs: z.number(),
  questionTimerMs: z.number(),
  playerScores: z.array(playerScoreSchema),
  finished: z.boolean(),
});

export const gameEndPayloadSchema = z.object({
  leaderboard: z.array(playerScoreSchema),
});

export interface TriviaQuizSessionState {
  currentQuestion: {
    text: string;
    options: string[];
    startedAtMs: number;
    timerMs: number;
  } | null;
  playerScores: PlayerScore[];
  finished: boolean;
  leaderboard: PlayerScore[];
}
