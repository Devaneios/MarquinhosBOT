import { z } from 'zod';
import { gridCellSchema } from '../payloadSchemas';
import { leaveMessageSchema } from '../protocol';

export type Cell = z.output<typeof gridCellSchema>;

export const foundWordSchema = z.object({
  word: z.string(),
  userId: z.string(),
  start: gridCellSchema,
  end: gridCellSchema,
});
export type FoundWord = z.output<typeof foundWordSchema>;

const scoresSchema = z.record(z.string(), z.number());

export const wordSearchRaceStateSchema = z.object({
  size: z.number(),
  grid: z.array(z.array(z.string())),
  words: z.array(z.string()),
  found: z.array(foundWordSchema),
  scores: scoresSchema,
  deadline: z.number(),
  ended: z.boolean(),
});
export type WordSearchRaceState = z.output<typeof wordSearchRaceStateSchema>;

export const selectPayloadSchema = z.object({
  start: gridCellSchema,
  end: gridCellSchema,
});

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('select'), payload: selectPayloadSchema }),
  leaveMessageSchema,
]);
export type WordSearchRaceClientMessage = z.output<typeof clientMessageSchema>;

export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('init'), payload: wordSearchRaceStateSchema }),
  z.object({
    type: z.literal('word_found'),
    payload: foundWordSchema.extend({ scores: scoresSchema }),
  }),
  z.object({
    type: z.literal('select_error'),
    payload: z.object({ message: z.string() }),
  }),
  z.object({
    type: z.literal('game_over'),
    payload: z.object({
      reason: z.enum(['completed', 'timeout']),
      scores: scoresSchema,
    }),
  }),
]);
export type WordSearchRaceServerMessage = z.output<typeof serverMessageSchema>;
