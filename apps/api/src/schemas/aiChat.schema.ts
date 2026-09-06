import { z } from 'zod';

export const aiChatRespondSchema = z.object({
  body: z.object({
    userId: z.string().min(1),
    guildId: z.string().min(1),
    channelId: z.string().min(1),
    content: z.string().min(1),
    recentMessages: z
      .array(z.object({ author: z.string(), content: z.string() }))
      .max(20),
    repliedMessage: z
      .object({ author: z.string(), content: z.string() })
      .optional(),
  }),
});

export const aiThreadAskSchema = z.object({
  body: z.object({
    threadId: z.string().min(1),
    guildId: z.string().min(1),
    channelId: z.string().min(1),
    userId: z.string().min(1),
    content: z.string().min(1).max(4000),
    mode: z.enum(['ask', 'research']).optional(),
  }),
});

export const aiResearchStartSchema = z.object({
  body: z.object({
    threadId: z.string().min(1),
    guildId: z.string().min(1),
    channelId: z.string().min(1),
    userId: z.string().min(1),
    query: z.string().min(3).max(1000),
    idempotencyKey: z.string().min(1),
  }),
});
