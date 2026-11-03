import { describe, expect, it } from 'bun:test';
import { collectVerifiedLeaderboard } from '../src/commands/games/termoLeaderboardMembers';

describe('community leaderboard membership', () => {
  it('skips departed members and continues fetching until ten members are ranked', async () => {
    const ids = Array.from({ length: 12 }, (_, index) => `u${index}`);
    const offsets: number[] = [];
    const result = await collectVerifiedLeaderboard(
      async (offset) => {
        offsets.push(offset);
        return {
          data: ids.slice(offset, offset + 10).map((userId) => ({ userId })),
          groupStreak: 2,
        };
      },
      async (userIds) =>
        new Map(
          userIds
            .filter((id) => id !== 'u0' && id !== 'u1')
            .map((id) => [id, { name: id }]),
        ),
    );
    expect(offsets).toEqual([0, 10]);
    expect(result.entries.map(({ entry }) => entry.userId)).toEqual(
      ids.slice(2),
    );
    expect(result.groupStreak).toBe(2);
  });
  it('fails instead of publishing unverified entries if Discord fails', async () => {
    await expect(
      collectVerifiedLeaderboard(
        async () => ({ data: [{ userId: 'u' }], groupStreak: 0 }),
        async () => {
          throw new Error('Discord unavailable');
        },
        [0, 0],
      ),
    ).rejects.toThrow('Discord unavailable');
  });
  it('retries a transient Discord failure', async () => {
    let calls = 0;
    const result = await collectVerifiedLeaderboard(
      async () => ({ data: [{ userId: 'u' }], groupStreak: 0 }),
      async (userIds) => {
        if (++calls === 1) throw new Error('rate limited');
        return new Map(userIds.map((id) => [id, { name: id }]));
      },
      [0, 0],
    );
    expect(calls).toBe(2);
    expect(result.entries.map(({ entry }) => entry.userId)).toEqual(['u']);
  });
  it('keeps the first position of a player repeated across pages', async () => {
    const pages = [
      Array.from({ length: 10 }, (_, index) => `u${index}`),
      ['u9', 'u10'],
    ];
    const result = await collectVerifiedLeaderboard(
      async (offset) => ({
        data: (pages[offset / 10] ?? []).map((userId) => ({ userId })),
        groupStreak: 0,
      }),
      async (userIds) =>
        new Map(
          userIds.filter((id) => id !== 'u0').map((id) => [id, { name: id }]),
        ),
      [0, 0],
    );
    expect(result.entries.map(({ entry }) => entry.userId)).toEqual([
      ...pages[0]!.slice(1),
      'u10',
    ]);
  });
});
