import { z } from 'zod';

export const wordChainStatePayloadSchema = z.object({
  currentWord: z.string(),
  currentTurn: z.string(),
  usedWords: z.array(z.string()),
  players: z.array(z.object({ userId: z.string(), alive: z.boolean() })),
  gameOver: z.boolean(),
  winner: z.string().nullable(),
});

export type GameState = z.infer<typeof wordChainStatePayloadSchema> & {
  userId: string;
};

export const wordRejectedPayloadSchema = z.object({ error: z.string() });

export const opponentDisconnectedPayloadSchema = z.object({
  userId: z.string(),
  timeoutMs: z.number(),
});
