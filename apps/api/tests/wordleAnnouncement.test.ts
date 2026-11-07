import { describe, expect, it } from 'bun:test';
import type { WordleService } from '../src/modules/wordle/wordle.service';
import { createWordleTestService } from './helpers/wordleServices';

async function solveDaily(
  service: WordleService,
  userId: string,
  guildId: string,
) {
  const daily = await service.getDailyWord(guildId);
  const result = await service.submitGuess(userId, guildId, daily.word);
  if ('error' in result) throw new Error(result.error);
  return result;
}

describe('WordleService announcement tracking', () => {
  it('returns a freshly solved session from getUnannouncedWins', async () => {
    const service = createWordleTestService();
    const guildId = `guild-${crypto.randomUUID()}`;
    const userId = 'user-a';

    await solveDaily(service, userId, guildId);

    const unannounced = await service.getUnannouncedWins(guildId);
    expect(unannounced.map((w) => w.userId)).toEqual([userId]);
  });

  it('excludes a session once markAnnounced has been called for it', async () => {
    const service = createWordleTestService();
    const guildId = `guild-${crypto.randomUUID()}`;
    const userId = 'user-b';

    await solveDaily(service, userId, guildId);
    await service.markAnnounced(userId, guildId);

    expect(await service.getUnannouncedWins(guildId)).toEqual([]);
  });

  it('returns true for the first claim and false for a repeat claim of the same win', async () => {
    const service = createWordleTestService();
    const guildId = `guild-${crypto.randomUUID()}`;
    const userId = 'user-e';

    await solveDaily(service, userId, guildId);

    expect(await service.markAnnounced(userId, guildId)).toBe(true);
    expect(await service.markAnnounced(userId, guildId)).toBe(false);
  });

  it('returns false when claiming a win that was never solved', async () => {
    const service = createWordleTestService();
    const guildId = `guild-${crypto.randomUUID()}`;

    expect(await service.markAnnounced('user-f', guildId)).toBe(false);
  });

  it('returns nothing for a guild with no solved sessions today', async () => {
    const service = createWordleTestService();
    const guildId = `guild-${crypto.randomUUID()}`;

    expect(await service.getUnannouncedWins(guildId)).toEqual([]);
  });

  it('scopes unannounced wins to the given guild', async () => {
    const service = createWordleTestService();
    const guildA = `guild-${crypto.randomUUID()}`;
    const guildB = `guild-${crypto.randomUUID()}`;

    await solveDaily(service, 'user-d', guildA);

    expect(await service.getUnannouncedWins(guildB)).toEqual([]);
    expect(
      (await service.getUnannouncedWins(guildA)).map((w) => w.userId),
    ).toEqual(['user-d']);
  });
});
