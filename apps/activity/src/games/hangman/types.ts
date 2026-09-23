import { z } from 'zod';

export const hangmanStateSchema = z.object({
  revealedWord: z.string(),
  guessedLetters: z.array(z.string()),
  strikes: z.number(),
  maxStrikes: z.number(),
  gameOver: z.boolean(),
  won: z.boolean(),
});

export const guessErrorPayloadSchema = z.object({ message: z.string() });
