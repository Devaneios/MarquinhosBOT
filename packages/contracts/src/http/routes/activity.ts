import { z } from 'zod';
import { activityModeSchema, gameIdSchema } from '../../activity/gameId';
import { defineContract, envelope } from '../contract';

const requiredString = z.string().min(1);

export const pongRatingPoolSchema = z.enum(['classic-1v1', 'quad-elimination']);
export type PongRatingPool = z.output<typeof pongRatingPoolSchema>;

export const pongTournamentFormatSchema = z.enum([
  'round-robin',
  'double-elimination',
  'swiss-playoff',
]);
export type PongTournamentFormat = z.output<typeof pongTournamentFormatSchema>;

export const pongRatingSchema = z.object({
  userId: z.string(),
  guildId: z.string(),
  pool: pongRatingPoolSchema,
  rating: z.number(),
  deviation: z.number(),
  volatility: z.number(),
  matches: z.number(),
  wins: z.number(),
});
export type PongRating = z.output<typeof pongRatingSchema>;

export const pongTournamentEntrySchema = z.object({
  userId: z.string(),
  seed: z.number(),
  rating: z.number(),
  score: z.number(),
  eliminated: z.number(),
});

export const pongTournamentMatchSchema = z.object({
  id: z.string(),
  bracket: z.string(),
  round: z.number(),
  position: z.number(),
  playerA: z.string().nullable(),
  playerB: z.string().nullable(),
  winnerId: z.string().nullable(),
  status: z.enum(['pending', 'ready', 'complete']),
});

export const pongTournamentSchema = z.object({
  id: z.string(),
  guildId: z.string(),
  name: z.string(),
  format: pongTournamentFormatSchema,
  pool: pongRatingPoolSchema,
  status: z.enum(['registration', 'active', 'complete']),
  config: z.object({ swissRounds: z.number() }),
  createdBy: z.string(),
  createdAt: z.number(),
  entries: z.array(pongTournamentEntrySchema),
  matches: z.array(pongTournamentMatchSchema),
});
export type PongTournament = z.output<typeof pongTournamentSchema>;

export const wsSessionSchema = z.object({
  token: z.string(),
  roomKey: z.string(),
});
export type WsSession = z.output<typeof wsSessionSchema>;

export const createdRoomSchema = z.object({
  roomId: z.string(),
  token: z.string(),
  roomKey: z.string(),
});
export type CreatedRoom = z.output<typeof createdRoomSchema>;

export const roomListingSchema = z.object({
  instanceId: z.string(),
  roomId: z.string(),
  game: gameIdSchema,
  hostUserId: z.string(),
  playerCount: z.number(),
  spectatorCount: z.number(),
  queueDepth: z.number(),
  queueEnabled: z.boolean(),
  mode: activityModeSchema,
});
export type RoomListing = z.output<typeof roomListingSchema>;

const guildAccess = z.object({
  accessToken: requiredString,
  guildId: requiredString,
});

const activityTags = ['Discord Activity'] as const;
const pongTags = ['Pong competition'] as const;
const activitySecurity = ['discordActivityBody'] as const;
const userId = '123456789012345678';
const otherPlayerId = '234567890123456789';
const guildId = '345678901234567890';
const instanceId = '456789012345678901';
const roomId = 'ROOM42';
const guildAccessExample = {
  accessToken: 'example-discord-activity-token',
  guildId,
};
const roomAccessExample = { ...guildAccessExample, instanceId };
const roomSessionExample = {
  token: 'example-signed-room-session',
  roomKey: `${instanceId}:${roomId}:tic-tac-toe:multi`,
};
const matchExample = {
  id: 'example-pong-match',
  bracket: 'round-robin',
  round: 1,
  position: 0,
  playerA: userId,
  playerB: otherPlayerId,
  winnerId: null,
  status: 'ready',
};
const tournamentExample = {
  id: 'example-pong-tournament',
  guildId,
  name: 'Pong de sexta',
  format: 'round-robin',
  pool: 'classic-1v1',
  status: 'active',
  config: { swissRounds: 1 },
  createdBy: userId,
  createdAt: 1795629600000,
  entries: [
    { userId, seed: 1, rating: 1500, score: 0, eliminated: 0 },
    { userId: otherPlayerId, seed: 2, rating: 1500, score: 0, eliminated: 0 },
  ],
  matches: [matchExample],
};

const badActivityRequest = {
  description: 'The JSON input did not satisfy the endpoint contract.',
  example: { message: 'Validation failed' },
};
const activityFailure = {
  description: 'The API could not complete the operation.',
  example: { message: 'Unknown Error' },
};
const activityThrottle = {
  description: 'The caller exceeded the shared Activity HTTP request budget.',
  example: { message: 'Too many requests, please try again later.' },
};
const activityBodyErrors = {
  400: badActivityRequest,
  413: {
    description: 'The request body exceeded the API JSON size limit.',
    example: { message: 'Request body too large' },
  },
  429: activityThrottle,
  500: activityFailure,
};
const activityUserErrors = {
  ...activityBodyErrors,
  401: {
    description:
      'Discord did not resolve the supplied Activity access token to a user.',
    example: { message: 'Invalid access token' },
  },
};
const activityMemberErrors = {
  ...activityUserErrors,
  403: {
    description:
      'The authenticated Discord user is outside the specified guild.',
    example: { message: 'Not a member of the specified guild' },
  },
};
const membershipUnavailable = {
  description: 'Discord membership verification was temporarily unavailable.',
  example: { message: 'Discord membership service unavailable' },
};

export const exchangeToken = defineContract({
  method: 'POST',
  path: '/api/activities/token',
  body: z.object({ code: requiredString }),
  response: envelope(z.object({ access_token: z.string() })),
  docs: {
    description:
      'Exchange the authorization code from the Embedded App SDK for a Discord access token. The Activity supplies the returned token to the SDK and to authenticated Activity operations.',
    tags: activityTags,
    security: [],
    examples: { body: { code: 'example-discord-authorization-code' } },
    success: {
      200: {
        description: 'Discord access token for the current Activity user.',
        example: { data: { access_token: 'example-discord-activity-token' } },
      },
    },
    errors: {
      ...activityBodyErrors,
      500: {
        ...activityFailure,
        description:
          'Discord rejected the code exchange or the API could not reach Discord.',
      },
    },
  },
});

export const wsSession = defineContract({
  method: 'POST',
  path: '/api/activities/ws-session',
  body: z
    .object({
      accessToken: requiredString,
      instanceId: requiredString,
      guildId: requiredString,
      mode: activityModeSchema,
      game: gameIdSchema,
      difficulty: z.enum(['easy', 'normal', 'hard']).optional(),
      winningScore: z.number().int().min(1).max(99).optional(),
      ruleset: z.string().min(1).optional(),
      options: z.record(z.string(), z.unknown()).optional(),
      roomId: z.string().min(1).optional(),
    })
    .superRefine((body, context) => {
      if (body.mode === 'multi' && !body.roomId) {
        context.addIssue({
          code: 'custom',
          path: ['roomId'],
          message: 'roomId is required for multi mode',
        });
      }
    }),
  response: envelope(wsSessionSchema),
  docs: {
    description:
      'Issue a five-minute credential for joining a Colyseus match. Multi mode requires a room ID. Multi mode and daily Wordle require guild membership. Pong reads options.bestOf and options.ranked, while Truco reads options.winningScore. Unsupported option values fall back to ruleset defaults.',
    tags: activityTags,
    security: activitySecurity,
    examples: {
      body: {
        ...roomAccessExample,
        mode: 'multi',
        game: 'tic-tac-toe',
        roomId,
      },
    },
    success: {
      200: {
        description:
          'Signed session credential and the corresponding room key.',
        example: { data: roomSessionExample },
      },
    },
    errors: {
      ...activityMemberErrors,
      400: {
        description:
          'The input failed validation, the multi room ID was missing, or the Pong ruleset or configuration was invalid.',
        example: { message: 'Invalid Pong ruleset' },
      },
    },
  },
});

export const pongLeaderboard = defineContract({
  method: 'POST',
  path: '/api/activities/pong/leaderboard',
  body: guildAccess.extend({
    pool: pongRatingPoolSchema,
    limit: z.number().int().min(1).max(100).optional(),
  }),
  response: envelope(z.array(pongRatingSchema)),
  docs: {
    description:
      'Read ranked Pong ratings for members of a guild within one rating pool. Classic and quad ratings are queried separately.',
    tags: pongTags,
    security: activitySecurity,
    examples: {
      body: { ...guildAccessExample, pool: 'classic-1v1', limit: 10 },
    },
    success: {
      200: {
        description: 'Matching player ratings and match counts.',
        example: {
          data: [
            {
              userId,
              guildId,
              pool: 'classic-1v1',
              rating: 1540,
              deviation: 290,
              volatility: 0.06,
              matches: 3,
              wins: 2,
            },
          ],
        },
      },
    },
    errors: activityMemberErrors,
  },
});

export const createPongTournament = defineContract({
  method: 'POST',
  path: '/api/activities/pong/tournaments/create',
  body: guildAccess.extend({
    name: z.string().min(1).max(80),
    format: pongTournamentFormatSchema,
    pool: pongRatingPoolSchema,
    playerIds: z.array(requiredString).min(2).max(64),
    swissRounds: z.number().int().min(1).max(10).optional(),
  }),
  response: envelope(pongTournamentSchema),
  docs: {
    description:
      'Seed a guild Pong tournament from the supplied player IDs and chosen format. The authenticated member becomes the tournament creator.',
    tags: pongTags,
    security: activitySecurity,
    examples: {
      body: {
        ...guildAccessExample,
        name: 'Pong de sexta',
        format: 'round-robin',
        pool: 'classic-1v1',
        playerIds: [userId, otherPlayerId],
      },
    },
    success: {
      201: {
        description:
          'Created tournament with seeded players and match schedule.',
        example: { data: tournamentExample },
      },
    },
    errors: {
      ...activityMemberErrors,
      400: {
        description:
          'The request or tournament player configuration was invalid.',
        example: { message: 'Double elimination supports at most 16 players' },
      },
    },
  },
});

export const listPongTournaments = defineContract({
  method: 'POST',
  path: '/api/activities/pong/tournaments/list',
  body: guildAccess,
  response: envelope(z.array(pongTournamentSchema)),
  docs: {
    description:
      'Read tournament snapshots for a guild so a player can open the current bracket and see pending or completed matches.',
    tags: pongTags,
    security: activitySecurity,
    examples: { body: guildAccessExample },
    success: {
      200: {
        description: 'Tournaments belonging to the requested guild.',
        example: { data: [tournamentExample] },
      },
    },
    errors: activityMemberErrors,
  },
});

export const reportPongTournamentMatch = defineContract({
  method: 'POST',
  path: '/api/activities/pong/tournaments/report',
  body: z.object({
    accessToken: requiredString,
    matchId: requiredString,
    winnerId: requiredString,
  }),
  response: envelope(pongTournamentSchema),
  docs: {
    description:
      'Report a winner for a ready Pong tournament match. The API checks the reporting Discord identity and advances the tournament when the result settles.',
    tags: pongTags,
    security: activitySecurity,
    examples: {
      body: {
        accessToken: guildAccessExample.accessToken,
        matchId: matchExample.id,
        winnerId: userId,
      },
    },
    success: {
      200: {
        description:
          'Updated tournament snapshot after recording the match winner.',
        example: {
          data: {
            ...tournamentExample,
            status: 'complete',
            entries: [
              { ...tournamentExample.entries[0], score: 1 },
              { ...tournamentExample.entries[1], eliminated: 1 },
            ],
            matches: [
              { ...matchExample, status: 'complete', winnerId: userId },
            ],
          },
        },
      },
    },
    errors: {
      ...activityUserErrors,
      400: {
        description:
          'The match is missing or cannot accept this winner or reporting user.',
        example: { message: 'Actor cannot report this match' },
      },
    },
  },
});

export const recordDeepLink = defineContract({
  method: 'POST',
  path: '/api/activities/deep-link',
  body: z.object({
    userId: requiredString,
    guildId: requiredString,
    game: gameIdSchema,
  }),
  response: envelope(z.object({ ok: z.literal(true) })),
  docs: {
    description:
      'Store a game launch intent before the bot opens the Discord Activity. A later record for the same user and guild replaces the pending intent.',
    tags: activityTags,
    security: ['botBearer'],
    examples: { body: { userId, guildId, game: 'wordle' } },
    success: {
      200: {
        description: 'The launch intent is available to claim for 60 seconds.',
        example: { data: { ok: true } },
      },
    },
    errors: {
      400: badActivityRequest,
      401: {
        description: 'The bot credential is missing or invalid.',
        example: { message: 'Token not authorized' },
      },
      413: activityBodyErrors[413],
      500: activityFailure,
    },
  },
});

export const claimDeepLink = defineContract({
  method: 'POST',
  path: '/api/activities/deep-link/claim',
  body: guildAccess,
  response: envelope(z.object({ game: gameIdSchema.nullable() })),
  docs: {
    description:
      'Consume a pending game launch intent for the authenticated user and guild. Repeating the claim returns a null game unless the bot stores another intent.',
    tags: activityTags,
    security: activitySecurity,
    examples: { body: guildAccessExample },
    success: {
      200: {
        description:
          'The game to open or null when no unexpired intent exists.',
        example: { data: { game: 'wordle' } },
      },
    },
    errors: activityUserErrors,
  },
});

export const createRoom = defineContract({
  method: 'POST',
  path: '/api/activities/rooms',
  body: z.object({
    accessToken: requiredString,
    instanceId: requiredString,
    guildId: requiredString,
    game: gameIdSchema,
    queueEnabled: z.boolean(),
  }),
  response: envelope(createdRoomSchema),
  docs: {
    description:
      'Allocate a multiplayer room ID and issue a credential for its creator in the specified Discord Activity instance. The creator chooses whether to enable the player queue.',
    tags: activityTags,
    security: activitySecurity,
    examples: {
      body: { ...roomAccessExample, game: 'tic-tac-toe', queueEnabled: true },
    },
    success: {
      200: {
        description: 'New room identifier, room key, and signed credential.',
        example: { data: { ...roomSessionExample, roomId } },
      },
    },
    errors: { ...activityMemberErrors, 503: membershipUnavailable },
  },
});

export const listRooms = defineContract({
  method: 'POST',
  path: '/api/activities/rooms/list',
  body: z.object({
    accessToken: requiredString,
    instanceId: requiredString,
    guildId: requiredString,
  }),
  response: envelope(z.array(roomListingSchema)),
  docs: {
    description:
      'List unlocked multiplayer match rooms in the requested Discord Activity instance. Each entry includes the room host and current player, spectator, and queue counts.',
    tags: activityTags,
    security: activitySecurity,
    examples: { body: roomAccessExample },
    success: {
      200: {
        description: 'Available rooms with valid listing metadata.',
        example: {
          data: [
            {
              instanceId,
              roomId,
              game: 'tic-tac-toe',
              hostUserId: userId,
              playerCount: 1,
              spectatorCount: 0,
              queueDepth: 0,
              queueEnabled: true,
              mode: 'multi',
            },
          ],
        },
      },
    },
    errors: { ...activityMemberErrors, 503: membershipUnavailable },
  },
});
