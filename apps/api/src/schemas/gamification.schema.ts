import { achievementConditionSchema } from 'services/gamification/AchievementService';
import { z } from 'zod';

const requiredString = z.string().min(1);

export const userGuildParamsSchema = z.object({
  userId: requiredString,
  guildId: requiredString,
});

export const guildParamsSchema = z.object({ guildId: requiredString });

export const guildGameTypeParamsSchema = z.object({
  guildId: requiredString,
  gameType: requiredString,
});

export const leaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).catch(10),
});

export const addXpBodySchema = z.object({
  userId: requiredString,
  guildId: requiredString,
  eventType: requiredString,
});

export const unlockAchievementBodySchema = z.object({
  userId: requiredString,
  guildId: requiredString,
  achievementId: requiredString,
});

export const createAchievementBodySchema = z.object({
  id: requiredString,
  name: requiredString,
  description: z.string(),
  category: requiredString,
  rarity: z.enum(['common', 'rare', 'epic', 'legendary']),
  icon: z.string(),
  condition: achievementConditionSchema,
  reward_xp: z.number().int().min(0),
});

export const recordGameResultBodySchema = z.object({
  sessionId: requiredString,
  guildId: requiredString,
  gameType: requiredString,
  durationMs: z.number().optional(),
  results: z
    .array(z.object({ userId: z.string(), position: z.number() }))
    .min(1),
});
