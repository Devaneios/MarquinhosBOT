import { z } from 'zod';
import { wordleGuessResultSchema } from '../../http/routes/wordle';
import {
  guessRowSchema,
  wordleAchievementsOverviewSchema,
  wordleDraftSchema,
  wordleDraftWriteResultSchema,
} from '../../wordle';

export const guessPayloadSchema = z.object({
  guess: z.string().default(''),
  // The day the client's board shows; lets the server refuse a guess typed
  // against a board that rolled over at midnight.
  date: z.iso.date().optional(),
  captureAchievementBaseline: z.boolean().optional(),
  requestId: z.uuid().optional(),
});

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('wordle_sync') }),
  z.object({ type: z.literal('guess'), payload: guessPayloadSchema }),
  z.object({
    type: z.literal('achievement_refresh'),
    payload: z.object({ requestId: z.number().int().positive() }),
  }),
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
      achievementPending: z.boolean().optional(),
      syncOnly: z.boolean().optional(),
    }),
  }),
  z.object({
    type: z.literal('guess_result'),
    payload: wordleGuessResultSchema,
  }),
  z.object({
    type: z.literal('guess_error'),
    payload: z.object({ message: z.string(), requestId: z.uuid().optional() }),
  }),
  z.object({
    type: z.literal('achievement_refresh_result'),
    payload: z.object({
      requestId: z.number().int().positive(),
      overview: wordleAchievementsOverviewSchema,
      pending: z.boolean(),
    }),
  }),
  z.object({
    type: z.literal('draft_result'),
    payload: wordleDraftWriteResultSchema.and(
      z.object({ requestId: z.number().int().positive().optional() }),
    ),
  }),
]);
export type WordleServerMessage = z.output<typeof serverMessageSchema>;
