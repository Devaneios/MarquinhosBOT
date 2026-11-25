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

export const addXpResultSchema = z.object({
  userLevel: userLevelSchema,
  onCooldown: z.boolean(),
  leveledUp: z.boolean(),
  newLevel: z.number().optional(),
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

const tag = ['Gamification'] as const;
const security = ['botBearer'] as const;
const userId = '123456789012345678';
const guildId = '234567890123456789';
const userLevelExample = {
  userId,
  guildId,
  level: 1,
  xp: 5,
  totalXp: 5,
  lastXpGain: '2026-11-25T19:00:00.000Z',
};
const botErrors = {
  401: {
    description: 'The bot credential is absent or invalid.',
    example: { message: 'Token not authorized' },
  },
  500: {
    description:
      'The operation could not complete or the server has no bot key configured.',
    example: { message: 'Unknown Error' },
  },
};
const bodyTooLarge = {
  description: 'The request body exceeded the API JSON size limit.',
  example: { message: 'Request body too large' },
};

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
  docs: {
    description:
      'Read the configured XP amount and cooldown for each event type. A null cooldown allows consecutive eligible events.',
    tags: tag,
    security,

    success: {
      200: {
        description: 'Current XP rules by event.',
        example: {
          data: [{ event_type: 'command', xp_amount: 5, cooldown_ms: 60000 }],
        },
      },
    },
    errors: botErrors,
  },
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
  docs: {
    description:
      'Award guild XP for a configured event. The API arbitrates concurrent claims for events with a cooldown and reports denied claims in the success envelope.',
    tags: tag,
    security,
    examples: { body: { userId, guildId, eventType: 'command' } },
    success: {
      200: {
        description:
          'Updated level with the award, or the existing level when the event is cooling down.',
        example: {
          data: {
            userLevel: userLevelExample,
            onCooldown: false,
            leveledUp: false,
          },
          message: 'XP added',
        },
      },
    },
    errors: {
      ...botErrors,
      400: {
        description:
          'A user ID, guild ID, or event type was missing or invalid.',
        example: { message: 'userId, guildId, and eventType are required' },
      },
      413: bodyTooLarge,
      500: {
        ...botErrors[500],
        description:
          'The event type was not configured, the award failed, or the server has no bot key.',
      },
    },
  },
});

export const getUserLevel = defineContract({
  method: 'GET',
  path: '/api/gamification/level/:userId/:guildId',
  params: userGuildParams,
  response: envelope(userLevelSchema),
  docs: {
    description:
      'Read XP and level in one guild. The first lookup initializes the user level and statistics rows when absent.',
    tags: tag,
    security,
    examples: { params: { userId, guildId } },
    success: {
      200: {
        description:
          'Guild level, current progress, total XP, and latest XP timestamp.',
        example: { data: userLevelExample },
      },
    },
    errors: {
      ...botErrors,
      400: {
        description: 'The route input did not supply both identifiers.',
        example: { message: 'userId and guildId are required' },
      },
    },
  },
});

export const getLeaderboard = defineContract({
  method: 'GET',
  path: '/api/gamification/leaderboard/:guildId',
  params: z.object({ guildId: requiredString }),
  query: z.object({
    limit: z.coerce.number().int().min(1).catch(10),
  }),
  response: envelope(z.array(userLevelSchema)),
  docs: {
    description:
      'Rank members of a guild by level and then total XP. The limit defaults to 10 for missing or invalid input and is capped at 25.',
    tags: tag,
    security,
    examples: { params: { guildId }, query: { limit: 10 } },
    success: {
      200: {
        description: 'Highest-ranked members in the requested guild.',
        example: { data: [userLevelExample] },
      },
    },
    errors: {
      ...botErrors,
      400: {
        description: 'The guild identifier did not pass validation.',
        example: { message: 'guildId is required' },
      },
    },
  },
});

export const initializeDefaults = defineContract({
  method: 'POST',
  path: '/api/gamification/achievements/initialize',
  response: z.object({ message: z.string() }),
  docs: {
    description:
      'Initialize the XP configuration and current achievement catalog. This maintenance operation also removes obsolete catalog data as part of reconciliation.',
    tags: tag,
    security,

    success: {
      200: {
        description:
          'XP configuration and achievement initialization finished.',
        example: { message: 'Defaults initialized' },
      },
    },
    errors: botErrors,
  },
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
  docs: {
    description:
      'Record one game and its player placements. A repeated session and player pair does not award XP twice. The same session ID can add previously unrecorded players, and a conflicting guild or game type fails.',
    tags: tag,
    security,
    examples: {
      body: {
        sessionId: 'example-pong-session',
        guildId,
        gameType: 'pong',
        durationMs: 42000,
        results: [{ userId, position: 1 }],
      },
    },
    success: {
      200: {
        description:
          'Results and progression updates committed, including previously applied results on replay.',
        example: { message: 'Game result recorded' },
      },
    },
    errors: {
      ...botErrors,
      400: {
        description:
          'The session, guild, game type, or player results failed validation.',
        example: {
          message: 'sessionId, guildId, gameType, and results are required',
        },
      },
      413: bodyTooLarge,
      500: {
        ...botErrors[500],
        description:
          'The session ID already belongs to a different guild or game type, or the result could not be recorded.',
      },
    },
  },
});

export const getUserGameStats = defineContract({
  method: 'GET',
  path: '/api/gamification/game-stats/:userId/:guildId',
  params: userGuildParams,
  response: envelope(userGameStatsSchema),
  docs: {
    description:
      'Read aggregate activity counters and a per-game breakdown for one member in one guild. The first lookup initializes missing progression rows.',
    tags: tag,
    security,
    examples: { params: { userId, guildId } },
    success: {
      200: {
        description:
          'Stored guild totals and played or won counts for each game.',
        example: {
          data: {
            stats: {
              user_id: userId,
              guild_id: guildId,
              total_commands: 4,
              total_scrobbles: 0,
              total_voice_joins: 1,
              total_games: 3,
              games_won: 2,
            },
            byGame: [{ game_type: 'pong', games_played: 3, wins: 2 }],
          },
        },
      },
    },
    errors: {
      ...botErrors,
      400: {
        description: 'The route input did not supply both identifiers.',
        example: { message: 'userId and guildId are required' },
      },
    },
  },
});

export const getGameLeaderboard = defineContract({
  method: 'GET',
  path: '/api/gamification/game-leaderboard/:guildId/:gameType',
  params: z.object({ guildId: requiredString, gameType: requiredString }),
  response: envelope(z.array(gameLeaderboardEntrySchema)),
  docs: {
    description:
      'Rank up to 25 players in one guild and game by wins, with total earned game XP as the second sort key.',
    tags: tag,
    security,
    examples: { params: { guildId, gameType: 'pong' } },
    success: {
      200: {
        description:
          'Game wins, participation counts, and XP for ranked players.',
        example: {
          data: [
            { user_id: userId, wins: 2, games_played: 3, total_xp_earned: 45 },
          ],
        },
      },
    },
    errors: {
      ...botErrors,
      400: {
        description: 'The route input did not supply both the guild and game.',
        example: { message: 'guildId and gameType are required' },
      },
    },
  },
});
