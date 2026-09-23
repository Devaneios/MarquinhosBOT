import { z } from 'zod';
import { defineContract, envelope, isoDate } from '../contract';

const userGuildParams = z.object({
  userId: z.string().min(1),
  guildId: z.string().min(1),
});

export const evolutionEventSchema = z.object({
  tier: z.number(),
  evolvedAt: z.string(),
  reason: z.string(),
});
export type EvolutionEvent = z.output<typeof evolutionEventSchema>;

export const evolutiveAchievementSchema = z.object({
  baseId: z.string(),
  name: z.string(),
  currentTier: z.number(),
  currentTierName: z.string(),
  icon: z.string(),
  rarity: z.enum(['common', 'rare', 'epic', 'legendary', 'mythical']),
  description: z.string(),
  unlockedAt: isoDate,
  lastEvolved: isoDate.nullable(),
  evolutionLog: z.array(evolutionEventSchema),
  nextTierThreshold: z.number().nullable(),
  currentStatValue: z.number(),
});

export const evolutionResultSchema = z.object({
  baseId: z.string(),
  newTier: z.number(),
  newTierName: z.string(),
  icon: z.string(),
});

export const evolutionTimelineEntrySchema = z.object({
  baseId: z.string(),
  name: z.string(),
  events: z.array(evolutionEventSchema),
});

export const checkAndEvolve = defineContract({
  method: 'POST',
  path: '/api/evolutive-achievements/evolve/:userId/:guildId',
  params: userGuildParams,
  response: envelope(z.array(evolutionResultSchema)),
});

export const getUserEvolutiveAchievements = defineContract({
  method: 'GET',
  path: '/api/evolutive-achievements/:userId/:guildId',
  params: userGuildParams,
  response: envelope(z.array(evolutiveAchievementSchema)),
});

export const getEvolutionTimeline = defineContract({
  method: 'GET',
  path: '/api/evolutive-achievements/timeline/:userId/:guildId',
  params: userGuildParams,
  response: envelope(z.array(evolutionTimelineEntrySchema)),
});
