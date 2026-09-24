import axios from 'axios';
import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import AuthController from 'controllers/auth.controller';
import { verifyDiscordToken } from 'middlewares/userAuth';
import type { DiscordService } from 'services/discord';
import { LastfmService } from 'services/lastfm';
import { encryptToken } from 'utils/crypto';

const SECRET = 'TOP-SECRET-VALUE';
const originalFetch = globalThis.fetch;

// Shaped like an AxiosError: the request config carries tokens and bodies.
function failedRequest() {
  return Object.assign(new Error('Request failed with status code 401'), {
    config: {
      url: `https://example.test/?sk=${SECRET}`,
      headers: { Authorization: `Bot ${SECRET}` },
      data: `client_secret=${SECRET}`,
    },
  });
}

const restores: (() => void)[] = [];

function captureConsole(): string[] {
  const lines: string[] = [];
  for (const method of ['error', 'warn', 'log'] as const) {
    const spy = spyOn(console, method).mockImplementation((...args) => {
      lines.push(args.map((arg) => Bun.inspect(arg)).join(' '));
    });
    restores.push(() => spy.mockRestore());
  }
  return lines;
}

function makeRes() {
  const res = {
    status: () => res,
    json: () => res,
    set: () => res,
  };
  return res as any;
}

afterEach(() => {
  restores.splice(0).forEach((restore) => restore());
  globalThis.fetch = originalFetch;
});

describe('failed requests carrying secrets', () => {
  it('are not logged with their config by the OAuth login', async () => {
    const lines = captureConsole();
    const discord = {
      requestToken: () => Promise.reject(failedRequest()),
    } as unknown as DiscordService;

    await new AuthController(discord).login(
      { query: { code: 'code' } } as any,
      makeRes(),
    );

    expect(lines.length).toBeGreaterThan(0);
    expect(lines.join('\n')).not.toContain(SECRET);
  });

  it('are not logged with their config by the token refresh', async () => {
    const lines = captureConsole();
    const discord = {
      refreshToken: () => Promise.reject(failedRequest()),
    } as unknown as DiscordService;
    const refreshToken = encryptToken('refresh')!;

    await new AuthController(discord).refreshToken(
      {
        headers: { 'refresh-token': refreshToken },
        get: () => refreshToken,
      } as any,
      makeRes(),
    );

    expect(lines.length).toBeGreaterThan(0);
    expect(lines.join('\n')).not.toContain(SECRET);
  });

  it('are not logged with their config by user token verification', async () => {
    const lines = captureConsole();
    globalThis.fetch = Object.assign(
      async () => new Response('{}', { status: 200 }),
      { preconnect: originalFetch.preconnect },
    );
    const get = spyOn(axios, 'get').mockRejectedValue(failedRequest());
    restores.push(() => get.mockRestore());
    const token = encryptToken('mock-access-token', Date.now() + 60_000);

    await verifyDiscordToken(
      { headers: { authorization: `Bearer ${token}` } } as any,
      makeRes(),
      () => {},
    );

    expect(lines.length).toBeGreaterThan(0);
    expect(lines.join('\n')).not.toContain(SECRET);
  });

  it('are not logged with their config by Last.fm now-playing', async () => {
    const lines = captureConsole();
    const post = spyOn(axios, 'post').mockRejectedValue(failedRequest());
    restores.push(() => post.mockRestore());

    await new LastfmService().updateNowPlaying(
      { artist: 'artist', name: 'track' } as any,
      'session-key',
    );

    expect(lines.length).toBeGreaterThan(0);
    expect(lines.join('\n')).not.toContain(SECRET);
  });
});
