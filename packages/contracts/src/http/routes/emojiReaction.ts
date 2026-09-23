import { z } from 'zod';
import { defineContract, envelope } from '../contract';

export const choose = defineContract({
  method: 'POST',
  path: '/api/emoji-reaction/choose',
  body: z.object({
    content: z.string().min(1),
    recentMessages: z
      .array(z.object({ author: z.string(), content: z.string() }))
      .max(10)
      .optional(),
  }),
  response: envelope(z.object({ emojis: z.array(z.string()) })),
});
