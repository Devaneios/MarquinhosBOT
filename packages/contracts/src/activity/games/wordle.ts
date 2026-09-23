import { z } from 'zod';
import { wordleGuessResultSchema } from '../../http/routes/wordle';
import { guessRowSchema } from '../../wordle';

export const guessPayloadSchema = z.object({ guess: z.string().default('') });

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('guess'), payload: guessPayloadSchema }),
]);
export type WordleClientMessage = z.input<typeof clientMessageSchema>;

export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('init'),
    payload: z.object({
      wordLength: z.number(),
      guesses: z.array(guessRowSchema),
      solved: z.boolean(),
      attempts: z.number(),
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
]);
export type WordleServerMessage = z.output<typeof serverMessageSchema>;
