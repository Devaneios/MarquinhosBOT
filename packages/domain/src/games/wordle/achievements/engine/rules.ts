import { z } from 'zod';
import { WORDLE_PATTERN_FAMILIES } from '../families';

const count = z.number().int().positive();
const hour = z.number().int().min(0).max(24);

export const wordleAchievementRuleSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('wins'), count }),
  z.object({ kind: z.literal('streak'), days: count }),
  z.object({ kind: z.literal('played'), days: count }),
  z.object({ kind: z.literal('wins_within'), maxAttempts: count, count }),
  z.object({
    kind: z.literal('fast_solve'),
    seconds: count,
    minAttempts: count,
  }),
  z.object({ kind: z.literal('first_solver'), count }),
  z
    .object({
      kind: z.literal('solved_at_hours'),
      fromHour: hour,
      toHour: hour,
    })
    .refine((rule) => rule.fromHour < rule.toHour),
  z.object({ kind: z.literal('blank_start') }),
  z.object({ kind: z.literal('staircase'), minAttempts: count }),
  z.object({ kind: z.literal('pattern'), patternId: z.string().min(1) }),
  z.object({
    kind: z.literal('pattern_collection'),
    family: z.enum(WORDLE_PATTERN_FAMILIES),
    count,
  }),
  z.object({ kind: z.literal('played_streak'), days: count }),
  z.object({
    kind: z.literal('calendar_coverage'),
    period: z.enum(['week', 'month']),
  }),
  z.object({ kind: z.literal('solved_exactly'), attempts: count }),
  z.object({ kind: z.literal('all_yellow_row') }),
  z.object({ kind: z.literal('mixed_rows'), count }),
  z.object({ kind: z.literal('near_miss') }),
  z.object({ kind: z.literal('answer_lengths') }),
  z.object({
    kind: z.literal('answer_vocabulary'),
    feature: z.enum(['repeated_letters', 'accent']),
  }),
]);
export type WordleAchievementRule = z.infer<typeof wordleAchievementRuleSchema>;
export type WordleAchievementRuleKind = WordleAchievementRule['kind'];
