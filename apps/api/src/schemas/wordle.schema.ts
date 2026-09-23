import { z } from 'zod';

const requiredString = z.string().min(1);

export const guildIdParamsSchema = z.object({ guildId: requiredString });

export const userGuildParamsSchema = z.object({
  userId: requiredString,
  guildId: requiredString,
});

export const submitGuessBodySchema = z.object({
  userId: requiredString,
  guildId: requiredString,
  guess: requiredString,
});

export const guildIdBodySchema = z.object({ guildId: requiredString });

export const userGuildBodySchema = z.object({
  userId: requiredString,
  guildId: requiredString,
});

export const setConfigBodySchema = z.object({
  guildId: requiredString,
  channelId: requiredString,
});

export const leaderboardQuerySchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly', 'all-time']).catch('all-time'),
});

export const validateGuessQuerySchema = z.object({ guess: requiredString });

export const reviewDecisionBodySchema = z.object({
  word: requiredString,
  decision: z.enum(['keep', 'remove']),
});
