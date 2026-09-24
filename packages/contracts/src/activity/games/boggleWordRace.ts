import { z } from 'zod';
import { gridCellSchema } from '../payloadSchemas';
import { leaveMessageSchema } from '../protocol';

export const MAX_PATH_LENGTH = 16;

export const submitRejectReasonSchema = z.enum([
  'not_started',
  'already_ended',
  'unknown_player',
  'invalid_path',
  'too_short',
  'not_a_word',
  'already_found',
]);
export type SubmitRejectReason = z.output<typeof submitRejectReasonSchema>;

export const boggleStateSchema = z.object({
  grid: z.array(z.array(z.string())),
  timeRemainingMs: z.number(),
  ended: z.boolean(),
  players: z.array(
    z.object({ userId: z.string(), score: z.number(), wordCount: z.number() }),
  ),
});
export type BoggleState = z.output<typeof boggleStateSchema>;

export const finalResultSchema = z.object({
  userId: z.string(),
  score: z.number(),
  words: z.array(z.string()),
});
export type BoggleFinalResult = z.output<typeof finalResultSchema>;

export const submitWordPayloadSchema = z.object({
  path: z.array(gridCellSchema).min(1).max(MAX_PATH_LENGTH),
});

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('submit_word'),
    payload: submitWordPayloadSchema,
  }),
  leaveMessageSchema,
]);
export type BoggleClientMessage = z.output<typeof clientMessageSchema>;

export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('init'),
    payload: z.object({
      grid: z.array(z.array(z.string())),
      state: boggleStateSchema,
    }),
  }),
  z.object({
    type: z.literal('word_accepted'),
    payload: z.object({
      userId: z.string(),
      word: z.string(),
      points: z.number(),
      totalScore: z.number(),
    }),
  }),
  z.object({
    type: z.literal('submit_error'),
    payload: z.object({ reason: submitRejectReasonSchema }),
  }),
  z.object({
    type: z.literal('game_over'),
    payload: z.object({ results: z.array(finalResultSchema) }),
  }),
]);
export type BoggleServerMessage = z.output<typeof serverMessageSchema>;
