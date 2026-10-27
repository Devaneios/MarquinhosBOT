import { z } from 'zod';
import { achievementRaritySchema } from './http/routes/gamification';

export const letterFeedbackSchema = z.enum(['correct', 'present', 'absent']);
export type LetterFeedback = z.infer<typeof letterFeedbackSchema>;

export const wordlePatternColorSchema = z.enum(['correct', 'present']);
export const wordlePatternRotationSchema = z.union([
  z.literal(0),
  z.literal(90),
  z.literal(180),
  z.literal(270),
]);
const patternCellSchema = z.tuple([
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
]);
export const wordlePatternPreviewSchema = z
  .object({
    patternId: z.string().min(1),
    mask: z.array(z.string().regex(/^[#.]+$/)).min(1),
    colors: z.array(wordlePatternColorSchema).min(1),
    rotations: z.array(wordlePatternRotationSchema).min(1),
  })
  .refine(
    (value) =>
      value.mask.some((row) => row.includes('#')) &&
      value.mask.every((row) => row.length === value.mask[0]?.length),
    'Pattern masks must be rectangular and contain a required cell',
  );
export type WordlePatternPreview = z.infer<typeof wordlePatternPreviewSchema>;

export const wordlePatternEvidenceSchema = z
  .object({
    patternId: z.string().min(1),
    color: wordlePatternColorSchema,
    origin: patternCellSchema,
    rotation: wordlePatternRotationSchema,
    cells: z.array(patternCellSchema).min(1),
    feedback: z.array(z.array(letterFeedbackSchema).min(1)).min(1),
    date: z.iso.date(),
  })
  .superRefine((value, context) => {
    const width = value.feedback[0]?.length ?? 0;
    const unique = new Set(
      value.cells.map(([row, column]) => `${row},${column}`),
    );
    if (
      value.feedback.some((row) => row.length !== width) ||
      unique.size !== value.cells.length ||
      value.origin[0] >= value.feedback.length ||
      value.origin[1] >= width ||
      value.cells.some(
        ([row, column]) =>
          row < value.origin[0] ||
          column < value.origin[1] ||
          value.feedback[row]?.[column] !== value.color,
      )
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'Pattern evidence must highlight unique, in-bounds cells of its foreground color',
      });
    }
  });
export type WordlePatternEvidence = z.infer<typeof wordlePatternEvidenceSchema>;

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
  patternPreview: wordlePatternPreviewSchema.optional(),
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
  matchEvidence: wordlePatternEvidenceSchema.nullable().optional(),
});
export type WordleAchievementStatus = z.infer<
  typeof wordleAchievementStatusSchema
>;

export const wordleUnlockedAchievementSchema = wordleAchievementSchema.extend({
  unlockedAt: z.iso.datetime(),
  matchEvidence: wordlePatternEvidenceSchema.nullable().optional(),
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
  achievementVersion: z.number().int().positive().default(1),
  achievements: z.array(wordleAchievementStatusSchema),
  stats: wordlePlayerStatsSchema,
});
export type WordleAchievementsOverview = z.infer<
  typeof wordleAchievementsOverviewSchema
>;

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
