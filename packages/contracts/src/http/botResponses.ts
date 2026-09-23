import { z } from 'zod';

export function apiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    data: dataSchema,
    message: z.string().optional(),
    error: z.string().optional(),
  });
}

const letterFeedbackSchema = z.enum(['correct', 'present', 'absent']);

const guessEntrySchema = z.object({
  guess: z.string(),
  feedback: z.array(letterFeedbackSchema),
});

export const userLevelSchema = z.object({
  userId: z.string(),
  guildId: z.string(),
  level: z.number(),
  xp: z.number(),
  totalXp: z.number(),
  lastXpGain: z.coerce.date().nullable(),
});

export const addXpResultSchema = z.object({
  userLevel: userLevelSchema,
  onCooldown: z.boolean(),
  leveledUp: z.boolean(),
  newLevel: z.number().optional(),
  unlockedAchievements: z.array(z.string()),
});

export const userAchievementSchema = z.object({
  userId: z.string(),
  guildId: z.string(),
  achievementId: z.string(),
  unlockedAt: z.coerce.date(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  rarity: z.enum(['common', 'rare', 'epic', 'legendary']),
  icon: z.string(),
  rewardXp: z.number(),
});

const aiChatCategorySchema = z.enum([
  'general_question',
  'code_technical_question',
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

export const researchStartResponseSchema =
  z.object({
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

export const researchJobResponseSchema =
  z.object({
    jobId: z.string(),
    status: z.enum(['queued', 'running', 'done', 'error']),
    query: z.string(),
    progress: z.array(researchProgressEventSchema),
    report: z.string().optional(),
    sources: z.array(researchSourceSchema).optional(),
    stats: researchStatsSchema.optional(),
    error: z.string().optional(),
  });

export const emojiReactionResponseSchema =
  z.object({
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

const playlistTrackSchema = z.object({
  title: z.string(),
  artist: z.string(),
  url: z.string(),
  addedBy: z.string(),
  addedAt: z.coerce.date(),
  votes: z.number(),
  voters: z.array(z.string()),
});

export const playlistSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  creatorId: z.string(),
  guildId: z.string(),
  isCollaborative: z.boolean(),
  tracks: z.array(playlistTrackSchema),
  followers: z.array(z.string()),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// Wordle / Termo

export const wordleConfigSchema = z.object({
  channelId: z.string().nullable(),
});
export type WordleConfig = z.infer<typeof wordleConfigSchema>;

export const wordleGuessResultSchema = z.object({
  guess: z.string(),
  feedback: z.array(letterFeedbackSchema),
  guesses: z.array(guessEntrySchema),
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
  guesses: z.array(guessEntrySchema),
});
export type WordleDayGuesses = z.infer<typeof wordleDayGuessesSchema>;

export const userWordleSessionSchema = z.object({
  guesses: z.array(guessEntrySchema),
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
  guesses: z.array(guessEntrySchema),
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

const userStatsSchema = z.object({
  user_id: z.string(),
  guild_id: z.string(),
  total_commands: z.number(),
  total_scrobbles: z.number(),
  total_voice_joins: z.number(),
  total_games: z.number(),
  games_won: z.number(),
});

export const userGameStatsSchema = z.object({
  stats: userStatsSchema,
  byGame: z.array(
    z.object({
      game_type: z.string(),
      games_played: z.number(),
      wins: z.number(),
    }),
  ),
});
export type UserGameStats = z.infer<typeof userGameStatsSchema>;

export const gameLeaderboardEntrySchema = z.object({
  user_id: z.string(),
  wins: z.number(),
  games_played: z.number(),
  total_xp_earned: z.number(),
});

export const unlockAchievementResultSchema = z.object({
  unlocked: z.boolean(),
});
