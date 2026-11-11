import { afterEach, describe, expect, it } from 'bun:test';
import { DiscordService } from 'integrations/discord/discord.service';
import { createTestAppConfig } from './helpers/testAppConfig';

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

    const member = await new DiscordService(
      createTestAppConfig(),
    ).isGuildMember('token', 'x/../../../../users/@me?');

    expect(member).toBe(false);
    expect(urls).toEqual([
      '/api/users/@me/guilds/x%2F..%2F..%2F..%2F..%2Fusers%2F%40me%3F/member',
    ]);
  });

  it('asks Discord once for a confirmed membership and never caches a refusal', async () => {
    let calls = 0;
    let status = 200;
    globalThis.fetch = Object.assign(
      async () => {
        calls++;
        return new Response('{}', { status });
      },
      { preconnect: originalFetch.preconnect },
    );
    const discord = new DiscordService(createTestAppConfig());

    expect(await discord.isGuildMember('token', 'guild')).toBe(true);
    expect(await discord.isGuildMember('token', 'guild')).toBe(true);
    expect(calls).toBe(1);

    status = 404;
    expect(await discord.isGuildMember('other-token', 'guild')).toBe(false);
    expect(await discord.isGuildMember('other-token', 'guild')).toBe(false);
    expect(await discord.isGuildMember('token', 'other-guild')).toBe(false);
    expect(calls).toBe(4);
  });
});
