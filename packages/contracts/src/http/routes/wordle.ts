import { z } from 'zod';
import {
  guessRowSchema,
  letterFeedbackSchema,
  wordleUserConfigSchema,
} from '../../wordle';
import { defineContract, envelope } from '../contract';

const requiredString = z.string().min(1);
const guildParams = z.object({ guildId: requiredString });
const userGuildParams = z.object({
  userId: requiredString,
  guildId: requiredString,
});

export const wordleGuessResultSchema = z.object({
  guess: z.string(),
  feedback: z.array(letterFeedbackSchema),
  guesses: z.array(guessRowSchema),
  solved: z.boolean(),
  attempts: z.number(),
  wordLength: z.number(),
  streak: z.number().optional(),
});
export type WordleGuessResult = z.output<typeof wordleGuessResultSchema>;

export const wordleDailyStatsSchema = z.object({
  wordDate: z.string(),
  wordLength: z.number(),
  playersCount: z.number(),
  winnersCount: z.number(),
  avgAttempts: z.number(),
});
export type WordleDailyStats = z.output<typeof wordleDailyStatsSchema>;

export const wordleDayGuessesSchema = z.object({
  word: z.string(),
  wordDate: z.string(),
  wordLength: z.number(),
  guesses: z.array(guessRowSchema),
});
export type WordleDayGuesses = z.output<typeof wordleDayGuessesSchema>;

export const wordleSessionSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  guild_id: z.string(),
  word_date: z.string(),
  guesses: z.array(guessRowSchema),
  solved: z.boolean(),
  attempts: z.number(),
  created_at: z.number(),
});

export const forceNewWordResultSchema = z.object({
  word: z.string(),
  wordDate: z.string(),
  wordLength: z.number(),
});

export const unannouncedWordleWinSchema = z.object({
  userId: z.string(),
  guesses: z.array(guessRowSchema),
  attempts: z.number(),
});
export type UnannouncedWordleWin = z.output<typeof unannouncedWordleWinSchema>;

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
export type DailyLeaderboardEntry = z.output<
  typeof dailyLeaderboardEntrySchema
>;

export const rankedLeaderboardEntrySchema = z.object({
  userId: z.string(),
  totalDays: z.number(),
  avgScore: z.number(),
});
export type RankedLeaderboardEntry = z.output<
  typeof rankedLeaderboardEntrySchema
>;

export const wordleLeaderboardPeriodSchema = z.enum([
  'daily',
  'weekly',
  'monthly',
  'all-time',
]);
export type WordleLeaderboardPeriod = z.output<
  typeof wordleLeaderboardPeriodSchema
>;

const messageOnly = z.object({ message: z.string() });

export const getUserConfig = defineContract({
  method: 'GET',
  path: '/api/wordle/user-config',
  response: z.object({ data: wordleUserConfigSchema }),
});

export const updateUserConfig = defineContract({
  method: 'PUT',
  path: '/api/wordle/user-config',
  body: wordleUserConfigSchema,
  response: z.object({ data: wordleUserConfigSchema }),
});

export const submitGuess = defineContract({
  method: 'POST',
  path: '/api/wordle/guess',
  body: z.object({
    userId: requiredString,
    guildId: requiredString,
    guess: requiredString,
  }),
  response: envelope(wordleGuessResultSchema),
});

export const getStats = defineContract({
  method: 'GET',
  path: '/api/wordle/stats/:guildId',
  params: guildParams,
  response: envelope(wordleDailyStatsSchema),
});

export const getUserSession = defineContract({
  method: 'GET',
  path: '/api/wordle/session/:userId/:guildId',
  params: userGuildParams,
  response: envelope(wordleSessionSchema.nullable()),
});

export const getDayGuesses = defineContract({
  method: 'GET',
  path: '/api/wordle/day-guesses/:guildId',
  params: guildParams,
  response: envelope(wordleDayGuessesSchema.nullable()),
});

export const forceNewWord = defineContract({
  method: 'POST',
  path: '/api/wordle/admin/force-new-word',
  body: z.object({ guildId: requiredString }),
  response: envelope(
    forceNewWordResultSchema.extend({ stats: wordleDailyStatsSchema }),
  ),
});

export const getLeaderboard = defineContract({
  method: 'GET',
  path: '/api/wordle/leaderboard/:guildId',
  params: guildParams,
  query: z.object({ period: wordleLeaderboardPeriodSchema.catch('all-time') }),
  response: z.object({
    data: z.union([
      z.array(dailyLeaderboardEntrySchema),
      z.array(rankedLeaderboardEntrySchema),
    ]),
    groupStreak: z.number(),
  }),
});

export const validateGuess = defineContract({
  method: 'GET',
  path: '/api/wordle/validate/:guildId',
  params: guildParams,
  query: z.object({ guess: requiredString }),
  response: envelope(
    z.object({
      valid: z.boolean(),
      wordLength: z.number(),
      message: z.string(),
    }),
  ),
});

export const setConfig = defineContract({
  method: 'POST',
  path: '/api/wordle/config',
  body: z.object({ guildId: requiredString, channelId: requiredString }),
  response: messageOnly,
});

export const getConfig = defineContract({
  method: 'GET',
  path: '/api/wordle/config/:guildId',
  params: guildParams,
  response: envelope(z.object({ channelId: z.string() }).nullable()),
});

export const markAnnounced = defineContract({
  method: 'POST',
  path: '/api/wordle/mark-announced',
  body: z.object({ userId: requiredString, guildId: requiredString }),
  response: envelope(z.object({ claimed: z.boolean() })),
});

export const getUnannouncedWins = defineContract({
  method: 'GET',
  path: '/api/wordle/unannounced/:guildId',
  params: guildParams,
  response: envelope(z.array(unannouncedWordleWinSchema)),
});

export const getStreak = defineContract({
  method: 'GET',
  path: '/api/wordle/streak/:userId/:guildId',
  params: userGuildParams,
  response: envelope(
    z.object({ currentStreak: z.number(), maxStreak: z.number() }),
  ),
});

export const getWordlistPoolStats = defineContract({
  method: 'GET',
  path: '/api/wordle/wordlist-pool-stats',
  response: envelope(
    z.object({ total: z.number(), used: z.number(), remaining: z.number() }),
  ),
});

export const getNextReviewWord = defineContract({
  method: 'GET',
  path: '/api/wordle/review/next',
  response: envelope(wordleReviewWordResultSchema),
});

export const submitReviewDecision = defineContract({
  method: 'POST',
  path: '/api/wordle/review/decision',
  body: z.object({
    word: requiredString,
    decision: z.enum(['keep', 'remove']),
  }),
  response: envelope(wordleReviewWordResultSchema),
});
