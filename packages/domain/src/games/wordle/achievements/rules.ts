import { z } from 'zod';

const count = z.number().int().positive();
const hour = z.number().int().min(0).max(24);

export const wordleAchievementRuleSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('wins'), count }),
  z.object({ kind: z.literal('streak'), days: count }),
  z.object({ kind: z.literal('played'), days: count }),
  z.object({ kind: z.literal('solved_within'), maxAttempts: count }),
  z.object({ kind: z.literal('wins_within'), maxAttempts: count, count }),
  z.object({ kind: z.literal('solved_after'), minAttempts: count }),
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
  z.object({ kind: z.literal('clean_solve'), minAttempts: count }),
  z.object({ kind: z.literal('blank_start'), maxAttempts: count }),
  z.object({ kind: z.literal('staircase'), minAttempts: count }),
  z.object({ kind: z.literal('phoenix'), days: count }),
  z.object({ kind: z.literal('pattern'), patternId: z.string().min(1) }),
  z.object({
    kind: z.literal('pattern_collection'),
    family: z.enum(['letter', 'digit', 'tetromino', 'shape']),
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
  z.object({ kind: z.literal('expired_unsolved') }),
  z.object({ kind: z.literal('recovery') }),
  z.object({ kind: z.literal('return_after_gap'), days: count }),
  z.object({ kind: z.literal('slow_solve'), seconds: count }),
  z.object({ kind: z.literal('answer_lengths') }),
  z.object({ kind: z.literal('attempt_variety'), maxAttempts: count }),
  z.object({
    kind: z.literal('answer_vocabulary'),
    feature: z.enum(['repeated_letters', 'accent']),
  }),
]);
export type WordleAchievementRule = z.infer<typeof wordleAchievementRuleSchema>;
export type WordleAchievementRuleKind = WordleAchievementRule['kind'];

export const WORDLE_ACHIEVEMENT_FAMILIES = [
  'wins',
  'streak',
  'played',
  'precision',
  'persistence',
  'speed',
  'timing',
  'style',
  'comeback',
  'participation_streak',
  'calendar',
  'feedback',
  'variety',
  'vocabulary',
  'letters',
  'digits',
  'tetrominoes',
  'shapes',
  'collections',
] as const;
export type WordleAchievementFamily =
  (typeof WORDLE_ACHIEVEMENT_FAMILIES)[number];
