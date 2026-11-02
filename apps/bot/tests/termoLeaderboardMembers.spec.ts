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
      ),
    ).rejects.toThrow('Discord unavailable');
  });
});
