import { z } from 'zod';
import { defineContract, envelope, isoDate } from '../contract';

const requiredString = z.string().min(1);

const userGuildParams = z.object({
  userId: requiredString,
  guildId: requiredString,
});

export const achievementRaritySchema = z.enum([
  'common',
  'rare',
  'epic',
  'legendary',
]);

export const userLevelSchema = z.object({
  userId: z.string(),
  guildId: z.string(),
  level: z.number(),
  xp: z.number(),
  totalXp: z.number(),
  lastXpGain: isoDate.nullable(),
});
export type UserLevel = z.output<typeof userLevelSchema>;

export const userAchievementSchema = z.object({
  userId: z.string(),
  guildId: z.string(),
  achievementId: z.string(),
  unlockedAt: isoDate,
  name: z.string(),
  description: z.string(),
  category: z.string(),
  rarity: achievementRaritySchema,
  icon: z.string(),
  rewardXp: z.number(),
});
export type UserAchievement = z.output<typeof userAchievementSchema>;

export const achievementConditionSchema = z.object({
  type: z.string(),
  threshold: z.number(),
});
export type AchievementCondition = z.output<typeof achievementConditionSchema>;

export const achievementSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  rarity: achievementRaritySchema,
  icon: z.string(),
  condition: z.string(),
  reward_xp: z.number(),
});

export const addXpResultSchema = z.object({
  userLevel: userLevelSchema,
  onCooldown: z.boolean(),
  leveledUp: z.boolean(),
  newLevel: z.number().optional(),
  unlockedAchievements: z.array(z.string()),
});
export type AddXpResult = z.output<typeof addXpResultSchema>;

export const userStatsSchema = z.object({
  user_id: z.string(),
  guild_id: z.string(),
  total_commands: z.number(),
  total_scrobbles: z.number(),
  total_voice_joins: z.number(),
  total_games: z.number(),
  games_won: z.number(),
});

export const userGameStatsSchema = z.object({
  stats: userStatsSchema,
  byGame: z.array(
    z.object({
      game_type: z.string(),
      games_played: z.number(),
      wins: z.number(),
    }),
  ),
});
export type UserGameStats = z.output<typeof userGameStatsSchema>;

export const gameLeaderboardEntrySchema = z.object({
  user_id: z.string(),
  wins: z.number(),
  games_played: z.number(),
  total_xp_earned: z.number(),
});

export const getXpConfig = defineContract({
  method: 'GET',
  path: '/api/gamification/xp-config',
  response: envelope(
    z.array(
      z.object({
        event_type: z.string(),
        xp_amount: z.number(),
        cooldown_ms: z.number().nullable(),
      }),
    ),
  ),
});

export const addXp = defineContract({
  method: 'POST',
  path: '/api/gamification/xp',
  body: z.object({
    userId: requiredString,
    guildId: requiredString,
    eventType: requiredString,
  }),
  response: envelope(addXpResultSchema),
});

export const getUserLevel = defineContract({
  method: 'GET',
  path: '/api/gamification/level/:userId/:guildId',
  params: userGuildParams,
  response: envelope(userLevelSchema),
});

export const getLeaderboard = defineContract({
  method: 'GET',
  path: '/api/gamification/leaderboard/:guildId',
  params: z.object({ guildId: requiredString }),
  query: z.object({
    limit: z.coerce.number().int().min(1).catch(10),
  }),
  response: envelope(z.array(userLevelSchema)),
});

export const unlockAchievement = defineContract({
  method: 'POST',
  path: '/api/gamification/achievement/unlock',
  body: z.object({
    userId: requiredString,
    guildId: requiredString,
    achievementId: requiredString,
  }),
  response: envelope(z.object({ unlocked: z.boolean() })),
});

export const getUserAchievements = defineContract({
  method: 'GET',
  path: '/api/gamification/achievements/:userId/:guildId',
  params: userGuildParams,
  response: envelope(z.array(userAchievementSchema)),
});

export const getAllAchievements = defineContract({
  method: 'GET',
  path: '/api/gamification/achievements',
  response: envelope(z.array(achievementSchema)),
});

export const createAchievement = defineContract({
  method: 'POST',
  path: '/api/gamification/achievements',
  body: z.object({
    id: requiredString,
    name: requiredString,
    description: z.string(),
    category: requiredString,
    rarity: achievementRaritySchema,
    icon: z.string(),
    condition: achievementConditionSchema,
    reward_xp: z.number().int().min(0),
  }),
  response: envelope(achievementSchema),
});

export const initializeDefaults = defineContract({
  method: 'POST',
  path: '/api/gamification/achievements/initialize',
  response: z.object({ message: z.string() }),
});

export const recordGameResult = defineContract({
  method: 'POST',
  path: '/api/gamification/game-result',
  body: z.object({
    sessionId: requiredString,
    guildId: requiredString,
    gameType: requiredString,
    durationMs: z.number().optional(),
    results: z
      .array(z.object({ userId: z.string(), position: z.number() }))
      .min(1),
  }),
  response: z.object({ message: z.string() }),
});

export const getUserGameStats = defineContract({
  method: 'GET',
  path: '/api/gamification/game-stats/:userId/:guildId',
  params: userGuildParams,
  response: envelope(userGameStatsSchema),
});

export const getGameLeaderboard = defineContract({
  method: 'GET',
  path: '/api/gamification/game-leaderboard/:guildId/:gameType',
  params: z.object({ guildId: requiredString, gameType: requiredString }),
  response: envelope(z.array(gameLeaderboardEntrySchema)),
});
