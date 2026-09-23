import { z } from 'zod';

export type GameMode = 'multi' | 'single';

const bingoCardSchema = z.object({
  board: z.array(z.array(z.number())),
  marked: z.array(z.array(z.boolean())),
});

export type BingoCard = z.infer<typeof bingoCardSchema>;

export const bingoInitPayloadSchema = z.object({
  card: bingoCardSchema.nullable(),
  state: z
    .object({
      drawnNumbers: z.array(z.number()),
      playerCount: z.number(),
      gameStarted: z.boolean(),
    })
    .optional(),
});

export const bingoNumberDrawnPayloadSchema = z.object({ number: z.number() });

export const bingoGameEndPayloadSchema = z.object({
  winner: z.string().optional(),
});
