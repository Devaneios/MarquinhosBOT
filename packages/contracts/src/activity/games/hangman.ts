import { z } from 'zod';

export const hangmanStateSchema = z.object({
  revealedWord: z.string(),
  guessedLetters: z.array(z.string()),
  strikes: z.number(),
  maxStrikes: z.number(),
  gameOver: z.boolean(),
  won: z.boolean(),
});
export type HangmanState = z.output<typeof hangmanStateSchema>;

export const guessPayloadSchema = z.object({ letter: z.string().default('') });

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('guess'), payload: guessPayloadSchema }),
]);
export type HangmanClientMessage = z.input<typeof clientMessageSchema>;

export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('init'), payload: hangmanStateSchema }),
  z.object({ type: z.literal('game_state'), payload: hangmanStateSchema }),
  z.object({ type: z.literal('guess_success'), payload: z.object({}) }),
  z.object({
    type: z.literal('guess_error'),
    payload: z.object({ message: z.string() }),
  }),
]);
export type HangmanServerMessage = z.output<typeof serverMessageSchema>;
