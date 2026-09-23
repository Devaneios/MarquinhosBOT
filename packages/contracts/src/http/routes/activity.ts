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

export const exchangeToken = defineContract({
  method: 'POST',
  path: '/api/activities/token',
  body: z.object({ code: requiredString }),
  response: envelope(z.object({ access_token: z.string() })),
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
});

export const pongLeaderboard = defineContract({
  method: 'POST',
  path: '/api/activities/pong/leaderboard',
  body: guildAccess.extend({
    pool: pongRatingPoolSchema,
    limit: z.number().int().min(1).max(100).optional(),
  }),
  response: envelope(z.array(pongRatingSchema)),
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
});

export const listPongTournaments = defineContract({
  method: 'POST',
  path: '/api/activities/pong/tournaments/list',
  body: guildAccess,
  response: envelope(z.array(pongTournamentSchema)),
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
});

export const claimDeepLink = defineContract({
  method: 'POST',
  path: '/api/activities/deep-link/claim',
  body: guildAccess,
  response: envelope(z.object({ game: gameIdSchema.nullable() })),
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
});
