import { z } from 'zod';

export const emojiReactionChooseSchema = z.object({
  body: z.object({
    content: z.string().min(1),
    recentMessages: z
      .array(z.object({ author: z.string(), content: z.string() }))
      .max(10)
      .optional(),
  }),
});
