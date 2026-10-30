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
const MAX_PATTERN_WIDTH = 6;
const patternMaskSchema = z.array(z.string().regex(/^[#.]+$/)).min(1);
const isRectangularMask = (mask: readonly string[]) =>
  mask.some((row) => row.includes('#')) &&
  mask.every((row) => row.length === mask[0]?.length);
export const wordlePatternPreviewSchema = z
  .object({
    patternId: z.string().min(1),
    mask: patternMaskSchema,
    variants: z.array(patternMaskSchema).optional(),
    colors: z.array(wordlePatternColorSchema).min(1),
    rotations: z.array(wordlePatternRotationSchema).min(1),
  })
  .refine(
    (value) =>
      isRectangularMask(value.mask) &&
      (value.mask[0]?.length ?? 0) <= MAX_PATTERN_WIDTH &&
      (value.variants ?? []).every(isRectangularMask),
    `Pattern masks must be rectangular, contain a required cell, and be at most ${MAX_PATTERN_WIDTH} columns wide`,
  )
  .refine((value) => {
    const baseWidth = value.mask[0]?.length ?? 0;
    const seen = new Set([value.mask.join('\n')]);
    return (value.variants ?? []).every((variant) => {
      const width = variant[0]?.length ?? 0;
      const key = variant.join('\n');
      if (width < baseWidth || width > MAX_PATTERN_WIDTH || seen.has(key))
        return false;
      seen.add(key);
      return true;
    });
  }, `Pattern variants must be distinct and between the base width and ${MAX_PATTERN_WIDTH} columns`);
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
export const wordleAchievementStatusSchema = wordleAchievementSchema.extend({
  unlockedAt: z.iso.datetime().nullable(),
  progress: wordleAchievementProgressSchema.nullable().default(null),
  holdersPercent: z.number().min(0).max(100).nullable().default(null),
  matchEvidence: wordlePatternEvidenceSchema.nullable().optional(),
});
export type WordleAchievementStatus = z.infer<
  typeof wordleAchievementStatusSchema
>;

export type WordleUnlockedAchievement = WordleAchievementStatus & {
  unlockedAt: string;
};

export const wordlePlayerStatsSchema = z.object({
  played: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  winRate: z.number().int().min(0).max(100),
  currentStreak: z.number().int().nonnegative(),
  bestStreak: z.number().int().nonnegative(),
  distribution: z.array(z.number().int().nonnegative()).length(8),
});
export type WordlePlayerStats = z.infer<typeof wordlePlayerStatsSchema>;

export const wordleAchievementsOverviewSchema = z.object({
  achievements: z.array(wordleAchievementStatusSchema),
  stats: wordlePlayerStatsSchema,
});
export type WordleAchievementsOverview = z.infer<
  typeof wordleAchievementsOverviewSchema
>;
export const wordleAchievementUpdateSchema = z.object({
  overview: wordleAchievementsOverviewSchema,
  unlockedIds: z.array(z.string()),
});
export type WordleAchievementUpdate = z.infer<
  typeof wordleAchievementUpdateSchema
>;

export const wordleDraftSchema = z.object({
  date: z.iso.date(),
  rowIndex: z.number().int().nonnegative(),
  cells: z.array(z.string().max(1)).min(5).max(12),
  activeIndex: z.number().int().min(0).max(11),
  revision: z.number().int().positive(),
});
export type WordleDraft = z.infer<typeof wordleDraftSchema>;

export const wordleDraftWriteSchema = z.object({
  date: z.iso.date(),
  rowIndex: z.number().int().nonnegative(),
  cells: z.array(z.string().max(1)).min(5).max(12),
  activeIndex: z.number().int().min(0).max(11),
  expectedRevision: z.number().int().nonnegative(),
});
export type WordleDraftWrite = z.infer<typeof wordleDraftWriteSchema>;

export const wordleDraftWriteResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('saved'),
    draft: wordleDraftSchema,
  }),
  z.object({
    status: z.literal('conflict'),
    draft: wordleDraftSchema.nullable(),
  }),
  z.object({ status: z.literal('closed') }),
]);
export type WordleDraftWriteResult = z.infer<
  typeof wordleDraftWriteResultSchema
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
