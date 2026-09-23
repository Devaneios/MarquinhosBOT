import { z } from 'zod';
import { defineContract, envelope } from '../contract';

const messageOnly = z.object({ message: z.string() });

export const login = defineContract({
  method: 'GET',
  path: '/api/auth/login',
  query: z.object({ code: z.string().min(1) }),
  response: messageOnly,
});

export const refreshToken = defineContract({
  method: 'GET',
  path: '/api/auth/refresh_token',
  response: messageOnly,
});

export const discordLoginUrl = defineContract({
  method: 'GET',
  path: '/api/auth/discordLoginUrl',
  query: z.object({ state: z.string().optional() }),
  response: envelope(z.string()),
});

export const lastfmLoginUrl = defineContract({
  method: 'GET',
  path: '/api/auth/lastfmLoginUrl',
  response: envelope(z.string()),
});
