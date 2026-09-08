import { beforeAll, describe, expect, it } from 'bun:test';

// Set in-memory db BEFORE any imports that load the db module — mirrors
// tests/wordle.test.ts so this suite doesn't touch the real marquinhos.db.
process.env.SQLITE_PATH = ':memory:';

let WordleService: typeof import('../src/services/wordle').WordleService;

beforeAll(async () => {
  ({ WordleService } = await import('../src/services/wordle'));
});

function solveDaily(
  service: InstanceType<typeof WordleService>,
  userId: string,
  guildId: string,
) {
  const daily = service.getDailyWord(guildId);
  const result = service.submitGuess(userId, guildId, daily.word);
  if ('error' in result) throw new Error(result.error);
  return result;
}

describe('WordleService announcement tracking', () => {
  it('returns a freshly solved session from getUnannouncedWins', () => {
    const service = new WordleService();
    const guildId = `guild-${crypto.randomUUID()}`;
    const userId = 'user-a';

    solveDaily(service, userId, guildId);

    const unannounced = service.getUnannouncedWins(guildId);
    expect(unannounced.map((w) => w.userId)).toEqual([userId]);
  });

  it('excludes a session once markAnnounced has been called for it', () => {
    const service = new WordleService();
    const guildId = `guild-${crypto.randomUUID()}`;
    const userId = 'user-b';

    solveDaily(service, userId, guildId);
    service.markAnnounced(userId, guildId);

    expect(service.getUnannouncedWins(guildId)).toEqual([]);
  });

  it('returns true for the first claim and false for a repeat claim of the same win', () => {
    const service = new WordleService();
    const guildId = `guild-${crypto.randomUUID()}`;
    const userId = 'user-e';

    solveDaily(service, userId, guildId);

    expect(service.markAnnounced(userId, guildId)).toBe(true);
    expect(service.markAnnounced(userId, guildId)).toBe(false);
  });

  it('returns false when claiming a win that was never solved', () => {
    const service = new WordleService();
    const guildId = `guild-${crypto.randomUUID()}`;

    expect(service.markAnnounced('user-f', guildId)).toBe(false);
  });

  it('returns nothing for a guild with no solved sessions today', () => {
    const service = new WordleService();
    const guildId = `guild-${crypto.randomUUID()}`;

    expect(service.getUnannouncedWins(guildId)).toEqual([]);
  });

  it('scopes unannounced wins to the given guild', () => {
    const service = new WordleService();
    const guildA = `guild-${crypto.randomUUID()}`;
    const guildB = `guild-${crypto.randomUUID()}`;

    solveDaily(service, 'user-d', guildA);

    expect(service.getUnannouncedWins(guildB)).toEqual([]);
    expect(service.getUnannouncedWins(guildA).map((w) => w.userId)).toEqual([
      'user-d',
    ]);
  });
});
