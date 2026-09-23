import type { PlaybackData, Track } from 'types';
import { z } from 'zod';

export const playbackDataSchema = z.object({
  title: z.string(),
  url: z.string().optional(),
  listeningUsersId: z.array(z.string()),
  timestamp: z.iso.datetime({ offset: true }),
  guildId: z.string(),
  channelId: z.string(),
  providerName: z.string(),
}) satisfies z.ZodType<PlaybackData>;

export const trackSchema = z.object({
  artist: z.string(),
  name: z.string(),
  durationInMillis: z.number(),
  album: z.string().optional(),
  coverArtUrl: z.string().optional(),
}) satisfies z.ZodType<Track>;

export const addScrobbleToQueueSchema = z.object({
  body: z.object({
    playbackData: playbackDataSchema,
  }),
});

export const scrobbleIdParamsSchema = z.object({ id: z.string().min(1) });

export const scrobbleUserParamsSchema = z.object({
  scrobbleId: z.string().min(1),
  userId: z.string().min(1),
});
