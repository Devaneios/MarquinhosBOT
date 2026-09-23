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
