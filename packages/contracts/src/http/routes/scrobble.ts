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
  retryCount: z.number().int().nonnegative().optional(),
  nextRetryAt: z.number().nonnegative().optional(),
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

const tags = ['Last.fm scrobbling'] as const;
const security = ['botBearer'] as const;
const id = 'c94a85a4-65fd-4b10-8abf-c676f16d422a';
const userId = '123456789012345678';
const scrobbleUserExample = { scrobbleId: id, userId };
const botAuthError = {
  description: 'The bot credential was absent or invalid.',
  example: { message: 'Token not authorized' },
};
const scrobbleUserInputError = {
  description: 'The request did not supply a valid scrobble ID and user ID.',
  example: { message: 'scrobbleId and userId are required' },
};

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
  docs: {
    tags,
    security,
    description:
      'Resolve a playback event to a track, enqueue the track, and update Last.fm now-playing status for eligible listeners. Tracks shorter than 30 seconds and unresolved tracks produce an acknowledgement without data.',
    examples: {
      body: {
        playbackData: {
          title: 'Daft Punk - Digital Love',
          listeningUsersId: [userId],
          timestamp: '2026-11-25T19:00:00.000Z',
          guildId: '234567890123456789',
          channelId: '345678901234567890',
          providerName: 'spotify',
        },
      },
    },
    success: {
      200: {
        description:
          'The playback was processed. When a queue row was created, data includes its ID, track, and scrobble-enabled listeners.',
        example: {
          data: {
            id,
            scrobblesOnUsers: [userId],
            track: {
              artist: 'Daft Punk',
              name: 'Digital Love',
              album: 'Discovery',
              durationInMillis: 301000,
            },
          },
          message: 'Scrobble added to queue',
        },
      },
    },
    errors: {
      400: {
        description: 'The playback event did not match the request schema.',
        example: { message: 'Validation failed' },
      },
      401: botAuthError,
      413: {
        description: 'The playback request exceeded the API JSON size limit.',
        example: { message: 'Request body too large' },
      },
      500: {
        description:
          'Track resolution or queue processing failed unexpectedly, or the server bot key is unavailable.',
        example: { message: 'Unknown Error' },
      },
    },
  },
});

export const dispatch = defineContract({
  method: 'POST',
  path: '/api/scrobble/:id',
  params: z.object({ id: z.string().min(1) }),
  response: envelope(z.string()),
  docs: {
    tags,
    security,
    description:
      'Attempt delivery to Last.fm for the eligible listeners in a queued playback. The API deletes settled entries and can retain transient failures for retry with backoff.',
    examples: { params: { id } },
    success: {
      200: {
        description:
          'Dispatch processed for the returned queue ID. Transient failures may have been deferred.',
        example: { data: id, message: 'Scrobbled' },
      },
    },
    errors: {
      400: {
        description: 'A valid queue ID was required.',
        example: { message: 'id is required' },
      },
      401: botAuthError,
      500: {
        description:
          'The queue entry was absent, could not be dispatched, or the server bot key is unavailable.',
        example: { message: 'Unknown Error' },
      },
    },
  },
});

export const removeUser = defineContract({
  method: 'DELETE',
  path: '/api/scrobble/:scrobbleId/:userId',
  params: scrobbleUserParams,
  response: envelope(z.string()),
  docs: {
    tags,
    security,
    description:
      'Remove a listener from a queued playback before dispatch. Removing the last listener deletes the queue entry.',
    examples: { params: scrobbleUserExample },
    success: {
      200: {
        description: 'Queue ID after the listener removal was processed.',
        example: { data: id, message: 'User removed' },
      },
    },
    errors: {
      400: scrobbleUserInputError,
      401: botAuthError,
      500: {
        description:
          'The queue entry was absent, could not be updated, or the server bot key is unavailable.',
        example: { message: 'Unknown Error' },
      },
    },
  },
});

export const addUser = defineContract({
  method: 'POST',
  path: '/api/scrobble/:scrobbleId/:userId',
  params: scrobbleUserParams,
  response: envelope(z.string()),
  docs: {
    tags,
    security,
    description:
      'Append an existing user to the listeners for a queued playback. The mutation rejects a listener already present in the queue entry.',
    examples: { params: scrobbleUserExample },
    success: {
      200: {
        description: 'Queue ID with the requested listener added.',
        example: { data: id, message: 'User added' },
      },
    },
    errors: {
      400: scrobbleUserInputError,
      401: botAuthError,
      500: {
        description:
          'The user or queue entry was absent, the user was already queued, or the update failed.',
        example: { message: 'Unknown Error' },
      },
    },
  },
});
