import { afterEach, describe, expect, it } from 'bun:test';
import { DiscordService } from 'services/discord';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('DiscordService.isGuildMember', () => {
  it('keeps the guild id inside its path segment', async () => {
    const urls: string[] = [];
    globalThis.fetch = Object.assign(
      async (input: Parameters<typeof fetch>[0]) => {
        urls.push(new URL(input.toString()).pathname);
        return new Response('', { status: 404 });
      },
      { preconnect: originalFetch.preconnect },
    );

    const member = await new DiscordService().isGuildMember(
      'token',
      'x/../../../../users/@me?',
    );

    expect(member).toBe(false);
    expect(urls).toEqual([
      '/api/users/@me/guilds/x%2F..%2F..%2F..%2F..%2Fusers%2F%40me%3F/member',
    ]);
  });
});
