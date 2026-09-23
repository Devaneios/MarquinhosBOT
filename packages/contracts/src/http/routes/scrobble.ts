import { z } from 'zod';
import { defineContract, envelope } from '../contract';

export const playbackDataSchema = z.object({
  title: z.string(),
  url: z.string().optional(),
  listeningUsersId: z.array(z.string()),
  timestamp: z.iso.datetime({ offset: true }),
  guildId: z.string(),
  channelId: z.string(),
  providerName: z.string(),
});
export type PlaybackData = z.output<typeof playbackDataSchema>;

export const trackSchema = z.object({
  artist: z.string(),
  name: z.string(),
  durationInMillis: z.number(),
  album: z.string().optional(),
  coverArtUrl: z.string().optional(),
});
export type Track = z.output<typeof trackSchema>;

const scrobbleUserParams = z.object({
  scrobbleId: z.string().min(1),
  userId: z.string().min(1),
});

export const addToQueue = defineContract({
  method: 'POST',
  path: '/api/scrobble/queue',
  body: z.object({ playbackData: playbackDataSchema }),
  response: envelope(
    z
      .object({
        id: z.string(),
        scrobblesOnUsers: z.array(z.string()),
        track: trackSchema,
      })
      .optional(),
  ),
});

export const dispatch = defineContract({
  method: 'POST',
  path: '/api/scrobble/:id',
  params: z.object({ id: z.string().min(1) }),
  response: envelope(z.string()),
});

export const removeUser = defineContract({
  method: 'DELETE',
  path: '/api/scrobble/:scrobbleId/:userId',
  params: scrobbleUserParams,
  response: envelope(z.string()),
});

export const addUser = defineContract({
  method: 'POST',
  path: '/api/scrobble/:scrobbleId/:userId',
  params: scrobbleUserParams,
  response: envelope(z.string()),
});
