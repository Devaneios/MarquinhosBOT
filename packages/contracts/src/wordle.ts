import { z } from 'zod';
import { achievementRaritySchema } from './http/routes/gamification';

export const wordleAchievementSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  rarity: achievementRaritySchema,
  rewardXp: z.number().int().nonnegative(),
});
export type WordleAchievement = z.infer<typeof wordleAchievementSchema>;

export const wordleAchievementStatusSchema = wordleAchievementSchema.extend({
  unlockedAt: z.iso.datetime().nullable(),
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
