import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import { buildDailyLeaderboardAttachment } from '../src/commands/games/termoLeaderboardImage';
import { MarquinhosApiService } from '../src/services/marquinhosApi';

function fakeGuild(memberIds: string[]) {
  const members = new Map(
    memberIds.map((id) => [
      id,
      {
        displayName: `Member-${id}`,
        displayAvatarURL: () => `https://example.com/${id}.png`,
      },
    ]),
  );
  return {
    members: {
      fetch: async () => members,
    },
  };
}

function fakeClient(
  guildId: string,
  guild: ReturnType<typeof fakeGuild> | null,
) {
  const cache = new Map();
  if (guild) cache.set(guildId, guild);
  return { guilds: { cache } } as any;
}

describe('buildDailyLeaderboardAttachment', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns null when there are no leaderboard entries for the day', async () => {
    const getLeaderboardSpy = spyOn(
      MarquinhosApiService.prototype,
      'getWordleLeaderboard',
    ).mockResolvedValue({ data: [], groupStreak: 0 } as any);

    const result = await buildDailyLeaderboardAttachment(
      fakeClient('guild-1', fakeGuild([])),
      'guild-1',
    );

    expect(result).toBeNull();
    getLeaderboardSpy.mockRestore();
  });

  it('returns null when the guild cannot be resolved', async () => {
    const getLeaderboardSpy = spyOn(
      MarquinhosApiService.prototype,
      'getWordleLeaderboard',
    ).mockResolvedValue({
      data: [{ userId: 'u1', attempts: 3, solved: true }],
      groupStreak: 0,
    } as any);

    const result = await buildDailyLeaderboardAttachment(
      fakeClient('guild-1', null),
      'guild-1',
    );

    expect(result).toBeNull();
    getLeaderboardSpy.mockRestore();
  });

  it('builds a non-empty image buffer and returns the group streak', async () => {
    globalThis.fetch = (async () =>
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
      })) as unknown as typeof fetch;

    const getLeaderboardSpy = spyOn(
      MarquinhosApiService.prototype,
      'getWordleLeaderboard',
    ).mockResolvedValue({
      data: [
        { userId: 'u1', attempts: 3, solved: true },
        { userId: 'u2', attempts: 5, solved: true },
      ],
      groupStreak: 7,
    } as any);

    const result = await buildDailyLeaderboardAttachment(
      fakeClient('guild-1', fakeGuild(['u1', 'u2'])),
      'guild-1',
    );

    expect(result).not.toBeNull();
    expect(result!.groupStreak).toBe(7);
    expect(result!.buffer.length).toBeGreaterThan(0);
    getLeaderboardSpy.mockRestore();
  });
});
