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
] as const;
export type WordleAchievementFamily =
  (typeof WORDLE_ACHIEVEMENT_FAMILIES)[number];
