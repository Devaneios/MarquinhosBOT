import { z } from 'zod';

export function apiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    data: dataSchema,
    message: z.string().optional(),
    error: z.string().optional(),
  });
}

export const emojiReactionResponseSchema = z.object({
  emojis: z.array(z.string()),
});

export const mazeViewportStateSchema = z.object({
  sessionId: z.string(),
  playerPosition: z.object({ x: z.number(), y: z.number() }),
  viewport: z.array(z.array(z.number())),
  moves: z.number(),
  isCompleted: z.boolean(),
  isAbandoned: z.boolean().optional(),
});
