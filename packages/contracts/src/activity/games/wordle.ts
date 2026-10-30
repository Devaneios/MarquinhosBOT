import { z } from 'zod';
import { wordleGuessResultSchema } from '../../http/routes/wordle';
import {
  guessRowSchema,
  wordleAchievementsOverviewSchema,
  wordleDraftSchema,
  wordleDraftWriteResultSchema,
} from '../../wordle';

export const guessPayloadSchema = z.object({ guess: z.string().default('') });

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('guess'), payload: guessPayloadSchema }),
  z.object({
    type: z.literal('draft_update'),
    payload: wordleDraftSchema.omit({ revision: true }).extend({
      expectedRevision: z.number().int().nonnegative(),
      requestId: z.number().int().positive(),
    }),
  }),
]);
export type WordleClientMessage = z.input<typeof clientMessageSchema>;

export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('init'),
    payload: z.object({
      wordLength: z.number(),
      date: z.iso.date(),
      guesses: z.array(guessRowSchema),
      solved: z.boolean(),
      attempts: z.number(),
      draft: wordleDraftSchema.nullable().optional(),
      achievementOverview: wordleAchievementsOverviewSchema.optional(),
    }),
  }),
  z.object({
    type: z.literal('guess_result'),
    payload: wordleGuessResultSchema,
  }),
  z.object({
    type: z.literal('guess_error'),
    payload: z.object({ message: z.string() }),
  }),
  z.object({
    type: z.literal('draft_result'),
    payload: wordleDraftWriteResultSchema.and(
      z.object({ requestId: z.number().int().positive().optional() }),
    ),
  }),
]);
export type WordleServerMessage = z.output<typeof serverMessageSchema>;
