import { activityModeSchema, gameIdSchema } from 'services/activity/gameId';
import { z } from 'zod';

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

export type MatchRoomMetadata = Omit<RoomListing, 'hostUserId'> & {
  roomKey: string;
  hostUserId: string | null;
};
