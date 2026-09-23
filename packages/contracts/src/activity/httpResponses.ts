import { z } from 'zod';
import { activityModeSchema, gameIdSchema } from './gameId';

export const tokenExchangeSchema = z.object({ access_token: z.string() });

export const wsSessionSchema = z.object({
  token: z.string(),
  roomKey: z.string(),
});

export type WsSession = z.infer<typeof wsSessionSchema>;

export const createdRoomSchema = z.object({
  roomId: z.string(),
  token: z.string(),
  roomKey: z.string(),
});

export type CreatedRoom = z.infer<typeof createdRoomSchema>;

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

export type RoomListing = z.infer<typeof roomListingSchema>;

export const deepLinkIntentSchema = z.object({
  game: gameIdSchema.nullable().catch(null),
});
