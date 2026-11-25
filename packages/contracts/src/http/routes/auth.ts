import { z } from 'zod';
import { defineContract, envelope } from '../contract';

const messageOnly = z.object({ message: z.string() });

const refreshTokenHeader = {
  description: 'Encrypted Discord refresh token issued by this API.',
  schema: z.string(),
  example: 'example-encrypted-refresh-token',
};

const tokenHeaders = {
  Authorization: {
    description:
      'Bearer token for the account API. Its credential wraps the Discord access token and expiry.',
    schema: z.string(),
    example: 'Bearer example-encrypted-access-token',
    required: true,
  },
  'Created-At': {
    description: 'UTC timestamp at which the credentials were issued.',
    schema: z.iso.datetime(),
    example: '2026-11-25T19:00:00.000Z',
    required: true,
  },
  'Expires-In': {
    description: 'Discord access token lifetime in seconds.',
    schema: z.string().regex(/^\d+$/),
    example: '604800',
    required: true,
  },
};

const oauthThrottled = {
  description: 'The caller exceeded the API request limit.',
  example: { message: 'ThrottlerException: Too Many Requests' },
};

export const login = defineContract({
  method: 'GET',
  path: '/api/auth/login',
  query: z.object({
    code: z.string().min(1),
    state: z.string().min(1).optional(),
  }),
  response: messageOnly,
  docs: {
    description:
      'Exchange a Discord authorization code for encrypted account credentials. A signed state, when supplied, must verify. The API creates a local user record on first login.',
    tags: ['Authentication'],
    security: ['discordOAuthCode'],
    examples: {
      query: {
        code: 'example-discord-authorization-code',
        state: 'example-signed-state',
      },
    },
    success: {
      200: {
        description:
          'Account authenticated and credentials issued in response headers.',
        example: { message: 'Authenticated successfully' },
        headers: {
          ...tokenHeaders,
          'Refresh-Token': { ...refreshTokenHeader, required: true },
        },
      },
    },
    errors: {
      400: {
        description:
          'The code is missing or the supplied OAuth state failed verification.',
        example: { message: 'Invalid OAuth state' },
      },
      429: oauthThrottled,
      500: {
        description:
          'The Discord exchange, local user lookup or creation, or credential encryption failed.',
        example: { message: 'Internal Server Error' },
      },
      502: {
        description:
          'Discord did not return a user for the issued access token.',
        example: { message: 'Discord user lookup failed' },
      },
    },
  },
});

export const refreshToken = defineContract({
  method: 'GET',
  path: '/api/auth/refresh_token',
  response: messageOnly,
  docs: {
    description:
      'Exchange an encrypted refresh token for a new account bearer token. Save the replacement refresh token when Discord rotates it.',
    tags: ['Authentication'],
    security: ['refreshTokenHeader'],
    requestHeaders: {
      'Refresh-Token': { ...refreshTokenHeader, required: true },
    },
    success: {
      200: {
        description:
          'New account bearer token issued. The refresh header is present when Discord supplies a replacement.',
        example: { message: 'Token refreshed' },
        headers: { ...tokenHeaders, 'Refresh-Token': refreshTokenHeader },
      },
    },
    errors: {
      400: {
        description: 'The Refresh-Token request header is missing.',
        example: { message: 'Refresh token not found' },
      },
      429: oauthThrottled,
      500: {
        description:
          'The refresh token could not be decrypted, Discord rejected the exchange, or encryption failed.',
        example: { message: 'Internal Server Error' },
      },
    },
  },
});

export const discordLoginUrl = defineContract({
  method: 'GET',
  path: '/api/auth/discordLoginUrl',
  query: z.object({ state: z.string().optional() }),
  response: envelope(z.string()),
  docs: {
    description:
      'Build the Discord authorization URL for the account login flow. The API signs the caller state before embedding it in the URL.',
    tags: ['Authentication'],
    security: [],
    examples: { query: { state: 'account-settings' } },
    success: {
      200: {
        description:
          'Discord authorization URL using the configured callback and member scopes.',
        example: {
          data: 'https://discord.com/oauth2/authorize?response_type=code&client_id=123456789012345678&scope=identify+guilds.members.read&redirect_uri=https%3A%2F%2Fexample.com%2Fcallback&prompt=none&state=example-signed-state',
        },
      },
    },
    errors: {
      429: oauthThrottled,
      500: {
        description:
          'The API could not construct the signed authorization URL.',
        example: { message: 'Internal Server Error' },
      },
    },
  },
});

export const lastfmLoginUrl = defineContract({
  method: 'GET',
  path: '/api/auth/lastfmLoginUrl',
  response: envelope(z.string()),
  docs: {
    description:
      'Build the Last.fm authorization URL with the configured API key and account-link callback.',
    tags: ['Authentication'],
    security: [],
    success: {
      200: {
        description:
          'Last.fm URL to open before submitting the returned account-link token.',
        example: {
          data: 'https://www.last.fm/api/auth/?api_key=example-public-api-key&cb=https://example.com/lastfm/callback',
        },
      },
    },
    errors: {
      429: oauthThrottled,
      500: {
        description:
          'An unexpected failure prevented the API from returning the authorization URL.',
        example: { message: 'Internal Server Error' },
      },
    },
  },
});
