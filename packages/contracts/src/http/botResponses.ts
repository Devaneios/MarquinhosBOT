import { z } from 'zod';
import { guessRowSchema, letterFeedbackSchema } from '../wordle';

export function apiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    data: dataSchema,
    message: z.string().optional(),
    error: z.string().optional(),
  });
}

const aiChatCategorySchema = z.enum([
  'general_question',
  'code_technical_question',
  'trick_riddle',
  'praise_thanks',
  'follow_up_on_bot',
  'opinion_reference',
  'bot_help_info',
  'user_roast_provocation',
  'casual_chat',
  'off_topic_unclear',
  'guardrail_roast',
  'agent_task',
]);

export const aiChatResponseSchema = z.object({
  status: z.enum(['ok', 'rate_limited', 'error']),
  category: aiChatCategorySchema.optional(),
  reply: z.string().optional(),
  format: z.enum(['embed', 'text']).optional(),
  embedTitle: z.string().optional(),
  traceId: z.string().optional(),
});

export const researchStartResponseSchema = z.object({
  status: z.enum(['accepted', 'rate_limited', 'rejected']),
  jobId: z.string().optional(),
  created: z.boolean().optional(),
  reply: z.string().optional(),
});

const researchProgressEventSchema = z.object({
  seq: z.number(),
  stage: z.string(),
  message: z.string(),
  createdAt: z.number(),
});

const researchSourceSchema = z.object({
  index: z.number(),
  url: z.string(),
  title: z.string(),
  publishedDate: z.string().optional(),
});

const researchStatsSchema = z.object({
  rounds: z.number(),
  searches: z.number(),
  fetched: z.number(),
  relevantSources: z.number(),
  maxDepth: z.number(),
  durationMs: z.number(),
  truncatedByBudget: z.boolean().optional(),
});

export const researchJobResponseSchema = z.object({
  jobId: z.string(),
  status: z.enum(['queued', 'running', 'done', 'error']),
  query: z.string(),
  progress: z.array(researchProgressEventSchema),
  report: z.string().optional(),
  sources: z.array(researchSourceSchema).optional(),
  stats: researchStatsSchema.optional(),
  error: z.string().optional(),
});

export const emojiReactionResponseSchema = z.object({
  emojis: z.array(z.string()),
});

export const mazeViewportStateSchema = z.object({
  sessionId: z.string(),
  playerPosition: z.object({ x: z.number(), y: z.number() }),
  viewport: z.array(z.array(z.number())),
  moves: z.number(),
  isCompleted: z.boolean(),
  isAbandoned: z.boolean().optional(),
});

// Wordle / Termo

export const wordleConfigSchema = z.object({
  channelId: z.string().nullable(),
});
export type WordleConfig = z.infer<typeof wordleConfigSchema>;

export const wordleGuessResultSchema = z.object({
  guess: z.string(),
  feedback: z.array(letterFeedbackSchema),
  guesses: z.array(guessRowSchema),
  solved: z.boolean(),
  attempts: z.number(),
  wordLength: z.number(),
  streak: z.number().optional(),
});
export type WordleGuessResult = z.infer<typeof wordleGuessResultSchema>;

export const wordleDailyStatsSchema = z.object({
  wordDate: z.string(),
  wordLength: z.number(),
  playersCount: z.number(),
  winnersCount: z.number(),
  avgAttempts: z.number(),
});
export type WordleDailyStats = z.infer<typeof wordleDailyStatsSchema>;

export const wordleDayGuessesSchema = z.object({
  word: z.string(),
  wordDate: z.string(),
  wordLength: z.number(),
  guesses: z.array(guessRowSchema),
});
export type WordleDayGuesses = z.infer<typeof wordleDayGuessesSchema>;

export const userWordleSessionSchema = z.object({
  guesses: z.array(guessRowSchema),
  solved: z.boolean(),
  attempts: z.number(),
});
export type UserWordleSession = z.infer<typeof userWordleSessionSchema>;

// Reconciled shape for `forceNewWordleWord`: admin.ts and ready.ts had drifted
// (admin.ts's version, which nests the daily stats under `stats`, matches
// what apps/api's WordleController#forceNewWord actually returns).
export const forceNewWordResultSchema = z.object({
  word: z.string(),
  wordDate: z.string(),
  wordLength: z.number(),
  stats: wordleDailyStatsSchema,
});
export type ForceNewWordResult = z.infer<typeof forceNewWordResultSchema>;

export const markWordleAnnouncedResultSchema = z.object({
  claimed: z.boolean(),
});

export const unannouncedWordleWinSchema = z.object({
  userId: z.string(),
  guesses: z.array(guessRowSchema),
  attempts: z.number(),
});
export type UnannouncedWordleWin = z.infer<typeof unannouncedWordleWinSchema>;

export const validateWordleGuessResultSchema = z.object({
  valid: z.boolean(),
  wordLength: z.number(),
  message: z.string(),
});

export const wordlistPoolStatsSchema = z.object({
  total: z.number(),
  used: z.number(),
  remaining: z.number(),
});

export const wordleReviewWordResultSchema = z.object({
  word: z.string().nullable(),
  index: z.number(),
  total: z.number(),
  done: z.boolean(),
});

export const dailyLeaderboardEntrySchema = z.object({
  userId: z.string(),
  attempts: z.number(),
  solved: z.boolean(),
});
export type DailyLeaderboardEntry = z.infer<typeof dailyLeaderboardEntrySchema>;

export const rankedLeaderboardEntrySchema = z.object({
  userId: z.string(),
  totalDays: z.number(),
  avgScore: z.number(),
});
export type RankedLeaderboardEntry = z.infer<
  typeof rankedLeaderboardEntrySchema
>;

export const wordleLeaderboardResultSchema = <T extends z.ZodTypeAny>(
  entrySchema: T,
) =>
  apiResponseSchema(z.array(entrySchema)).and(
    z.object({ groupStreak: z.number() }),
  );

// Gamification
