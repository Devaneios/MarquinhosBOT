import { z } from 'zod';
import { defineContract } from '../contract';

export const lastfmTopListenedPeriodSchema = z.enum([
  '7day',
  '1month',
  '3month',
  '6month',
  '12month',
  'overall',
]);
export type LastfmTopListenedPeriod = z.output<
  typeof lastfmTopListenedPeriodSchema
>;

const messageOnly = z.object({ message: z.string() });
const scrobbleStatusSchema = z.object({
  id: z.string(),
  scrobblesOn: z.boolean(),
});
const coverArtItemSchema = z.object({
  name: z.string(),
  coverArtUrl: z.string(),
});
const topListenedParams = z.object({
  period: lastfmTopListenedPeriodSchema,
  id: z.string().min(1),
});

export const getProfile = defineContract({
  method: 'GET',
  path: '/api/user/profile',
  response: z.looseObject({
    id: z.string(),
    highestRole: z.string().optional(),
  }),
});

export const exists = defineContract({
  method: 'GET',
  path: '/api/user/exists/:id',
  params: z.object({ id: z.string().min(1) }),
  response: z.object({ id: z.string() }).nullable(),
});

export const lastfmStatus = defineContract({
  method: 'GET',
  path: '/api/user/lastfm-status',
  response: scrobbleStatusSchema,
});

export const enableLastfm = defineContract({
  method: 'POST',
  path: '/api/user/enable-lastfm',
  body: z.object({ token: z.string().min(1) }),
  response: messageOnly,
});

export const deleteLastfmData = defineContract({
  method: 'DELETE',
  path: '/api/user/lastfm',
  response: messageOnly,
});

export const deleteAllData = defineContract({
  method: 'DELETE',
  path: '/api/user',
  response: messageOnly,
});

export const toggleScrobbles = defineContract({
  method: 'PATCH',
  path: '/api/user/toggle-scrobble',
  response: scrobbleStatusSchema,
});

export const getTopArtists = defineContract({
  method: 'GET',
  path: '/api/user/top-artists/:period/:id',
  params: topListenedParams,
  response: z.object({
    artists: z.array(coverArtItemSchema),
    profileName: z.string(),
  }),
});

export const getTopAlbums = defineContract({
  method: 'GET',
  path: '/api/user/top-albums/:period/:id',
  params: topListenedParams,
  response: z.object({
    albums: z.array(coverArtItemSchema),
    profileName: z.string(),
  }),
});

export const getTopTracks = defineContract({
  method: 'GET',
  path: '/api/user/top-tracks/:period/:id',
  params: topListenedParams,
  response: z.object({
    tracks: z.array(coverArtItemSchema),
    profileName: z.string(),
  }),
});
