import { z } from 'zod';
import { achievementRaritySchema } from './http/routes/gamification';

export const wordleAchievementSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  rarity: achievementRaritySchema,
  rewardXp: z.number().int().nonnegative(),
  family: z.string().default('wordle'),
  tier: z.number().int().min(1).default(1),
  hidden: z.boolean().default(false),
});
export type WordleAchievement = z.infer<typeof wordleAchievementSchema>;

export const wordleAchievementProgressSchema = z.object({
  current: z.number().int().nonnegative(),
  target: z.number().int().positive(),
});
export const wordleAchievementProgressUpdateSchema = z.object({
  id: z.string(),
  progress: wordleAchievementProgressSchema.nullable(),
});
export type WordleAchievementProgressUpdate = z.infer<
  typeof wordleAchievementProgressUpdateSchema
>;

export const wordleAchievementStatusSchema = wordleAchievementSchema.extend({
  unlockedAt: z.iso.datetime().nullable(),
  progress: wordleAchievementProgressSchema.nullable().default(null),
  holdersPercent: z.number().min(0).max(100).nullable().default(null),
});
export type WordleAchievementStatus = z.infer<
  typeof wordleAchievementStatusSchema
>;

export const wordleUnlockedAchievementSchema = wordleAchievementSchema.extend({
  unlockedAt: z.iso.datetime(),
});
export type WordleUnlockedAchievement = z.infer<
  typeof wordleUnlockedAchievementSchema
>;

export const wordlePlayerStatsSchema = z.object({
  played: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  winRate: z.number().int().min(0).max(100),
  currentStreak: z.number().int().nonnegative(),
  bestStreak: z.number().int().nonnegative(),
  distribution: z.array(z.number().int().nonnegative()).length(7),
});
export type WordlePlayerStats = z.infer<typeof wordlePlayerStatsSchema>;

export const wordleAchievementsOverviewSchema = z.object({
  achievements: z.array(wordleAchievementStatusSchema),
  stats: wordlePlayerStatsSchema,
});
export type WordleAchievementsOverview = z.infer<
  typeof wordleAchievementsOverviewSchema
>;

export const letterFeedbackSchema = z.enum(['correct', 'present', 'absent']);
export type LetterFeedback = z.infer<typeof letterFeedbackSchema>;

export const guessRowSchema = z.object({
  guess: z.string(),
  feedback: z.array(letterFeedbackSchema),
});
export type GuessRow = z.infer<typeof guessRowSchema>;

const wordleUserConfigBaseSchema = z.object({
  invertActionKeys: z.boolean(),
  enableSounds: z.boolean(),
});

export const wordleUserConfigSchema = z.discriminatedUnion('enableSpaceKey', [
  wordleUserConfigBaseSchema.extend({
    enableSpaceKey: z.literal(false),
    enableArrowKeys: z.literal(false),
  }),
  wordleUserConfigBaseSchema.extend({
    enableSpaceKey: z.literal(true),
    enableArrowKeys: z.boolean(),
  }),
]);
export type WordleUserConfig = z.infer<typeof wordleUserConfigSchema>;
