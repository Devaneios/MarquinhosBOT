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

const accountTags = ['Accounts'] as const;
const lastfmTags = ['Last.fm profiles'] as const;
const accountSecurity = ['discordUserBearer'] as const;
const botSecurity = ['botBearer'] as const;
const userId = '123456789012345678';
const topItemsExample = { params: { period: '1month', id: userId } };
const accountErrors = {
  401: {
    description:
      'The account token is absent, invalid, or expired, or its Discord identity has no local user record.',
    example: { message: 'Invalid or expired token' },
  },
  429: {
    description: 'The caller exceeded the account API request limit.',
    example: { message: 'ThrottlerException: Too Many Requests' },
  },
  500: {
    description:
      'The API could not verify the Discord identity or complete the account operation.',
    example: { message: 'Internal Server Error' },
  },
};
const topItemsErrors = {
  400: {
    description: 'The user ID or Last.fm period did not pass validation.',
    example: { message: 'Invalid user id or period' },
  },
  401: {
    description: 'The bot credential was absent or invalid.',
    example: { message: 'Token not authorized' },
  },
  500: {
    description:
      'The user record or Last.fm listening history could not be retrieved, or the bot key was unavailable.',
    example: { message: 'Unknown Error' },
  },
};

export const getProfile = defineContract({
  method: 'GET',
  path: '/api/user/profile',
  response: z.looseObject({
    id: z.string(),
    highestRole: z.string().optional(),
  }),
  docs: {
    description:
      'Return the authenticated Discord user and the highest role resolved for the configured guild when available. Additional fields can come from Discord.',
    tags: accountTags,
    security: accountSecurity,

    success: {
      200: {
        description:
          'Discord profile for the identity carried by the account token.',
        example: { id: userId, username: 'bia', global_name: 'Bia' },
      },
    },
    errors: accountErrors,
  },
});

export const exists = defineContract({
  method: 'GET',
  path: '/api/user/exists/:id',
  params: z.object({ id: z.string().min(1) }),
  response: z.object({ id: z.string() }).nullable(),
  docs: {
    description:
      'Check whether the authenticated user has a local record. The caller can query only their own Discord ID.',
    tags: accountTags,
    security: accountSecurity,
    examples: { params: { id: userId } },
    success: {
      200: {
        description:
          'The matching user ID, or null if the record disappeared after authentication.',
        example: { id: userId },
      },
    },
    errors: {
      ...accountErrors,
      400: {
        description: 'The ID did not pass validation.',
        example: { message: 'id is required' },
      },
      403: {
        description: 'The requested ID belongs to a different user.',
        example: { message: 'Forbidden' },
      },
    },
  },
});

export const lastfmStatus = defineContract({
  method: 'GET',
  path: '/api/user/lastfm-status',
  response: scrobbleStatusSchema,
  docs: {
    description:
      'Check whether the authenticated account has a valid Last.fm session and whether scrobbling is enabled.',
    tags: lastfmTags,
    security: accountSecurity,

    success: {
      200: {
        description: 'A valid Last.fm link and the current scrobble setting.',
        example: { id: userId, scrobblesOn: true },
      },
    },
    errors: {
      ...accountErrors,
      404: {
        description: 'No valid Last.fm session token was found.',
        example: { message: 'Lastfm token not found' },
      },
    },
  },
});

export const enableLastfm = defineContract({
  method: 'POST',
  path: '/api/user/enable-lastfm',
  body: z.object({ token: z.string().min(1) }),
  response: messageOnly,
  docs: {
    description:
      'Exchange a Last.fm authorization token, store the encrypted session credential for the authenticated Discord user, and enable scrobbling.',
    tags: lastfmTags,
    security: accountSecurity,
    examples: { body: { token: 'example-lastfm-authorization-token' } },
    success: {
      200: {
        description: 'The Last.fm connection is stored.',
        example: { message: 'Lastfm enabled' },
      },
    },
    errors: {
      ...accountErrors,
      400: {
        description: 'The Last.fm authorization token was missing or empty.',
        example: { message: 'Missing credentials' },
      },
      413: {
        description: 'The request body exceeded the API JSON size limit.',
        example: { message: 'Request body too large' },
      },
      500: {
        description:
          'Last.fm rejected the exchange or the API could not store the session.',
        example: { message: 'Unknown Error' },
      },
    },
  },
});

export const deleteLastfmData = defineContract({
  method: 'DELETE',
  path: '/api/user/lastfm',
  response: messageOnly,
  docs: {
    description:
      'Clear the authenticated user’s stored Last.fm session, username, and scrobble setting.',
    tags: lastfmTags,
    security: accountSecurity,

    success: {
      200: {
        description: 'The local Last.fm connection was cleared.',
        example: { message: 'User deleted' },
      },
    },
    errors: accountErrors,
  },
});

export const deleteAllData = defineContract({
  method: 'DELETE',
  path: '/api/user',
  response: messageOnly,
  docs: {
    description:
      'Delete the authenticated user’s stored account and user-owned rows in one transaction. Existing pattern challenges can remain with their creator field cleared.',
    tags: accountTags,
    security: accountSecurity,

    success: {
      200: {
        description: 'The local account deletion transaction committed.',
        example: { message: 'User deleted' },
      },
    },
    errors: accountErrors,
  },
});

export const toggleScrobbles = defineContract({
  method: 'PATCH',
  path: '/api/user/toggle-scrobble',
  response: scrobbleStatusSchema,
  docs: {
    description:
      'Flip the authenticated account’s stored scrobble preference and return the new value. Repeating the same request flips the preference again.',
    tags: lastfmTags,
    security: accountSecurity,

    success: {
      200: {
        description: 'Updated scrobble preference.',
        example: { id: userId, scrobblesOn: false },
      },
    },
    errors: accountErrors,
  },
});

export const getTopArtists = defineContract({
  method: 'GET',
  path: '/api/user/top-artists/:period/:id',
  params: topListenedParams,
  response: z.object({
    artists: z.array(coverArtItemSchema),
    profileName: z.string(),
  }),
  docs: {
    description:
      'Read up to ten of the selected user’s top Last.fm artists for the requested period. Cover lookup can fall back to an empty URL.',
    tags: lastfmTags,
    security: botSecurity,
    examples: topItemsExample,
    success: {
      200: {
        description: 'Top artists and the display name used by the bot.',
        example: {
          artists: [{ name: 'Daft Punk', coverArtUrl: '' }],
          profileName: 'Bia',
        },
      },
    },
    errors: topItemsErrors,
  },
});

export const getTopAlbums = defineContract({
  method: 'GET',
  path: '/api/user/top-albums/:period/:id',
  params: topListenedParams,
  response: z.object({
    albums: z.array(coverArtItemSchema),
    profileName: z.string(),
  }),
  docs: {
    description:
      'Read up to ten of the selected user’s top Last.fm albums for the requested period. Cover lookup can fall back to an empty URL.',
    tags: lastfmTags,
    security: botSecurity,
    examples: topItemsExample,
    success: {
      200: {
        description: 'Top albums and the display name used by the bot.',
        example: {
          albums: [{ name: 'Discovery', coverArtUrl: '' }],
          profileName: 'Bia',
        },
      },
    },
    errors: topItemsErrors,
  },
});

export const getTopTracks = defineContract({
  method: 'GET',
  path: '/api/user/top-tracks/:period/:id',
  params: topListenedParams,
  response: z.object({
    tracks: z.array(coverArtItemSchema),
    profileName: z.string(),
  }),
  docs: {
    description:
      'Read up to ten of the selected user’s top Last.fm tracks for the requested period. Cover lookup can fall back to an empty URL.',
    tags: lastfmTags,
    security: botSecurity,
    examples: topItemsExample,
    success: {
      200: {
        description: 'Top tracks and the display name used by the bot.',
        example: {
          tracks: [{ name: 'Digital Love', coverArtUrl: '' }],
          profileName: 'Bia',
        },
      },
    },
    errors: topItemsErrors,
  },
});
