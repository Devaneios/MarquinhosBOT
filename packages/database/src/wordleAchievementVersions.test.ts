import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { wordleAchievementVersions, wordlePatternDiscoveries } from './schema';
import { createTestDb, type TestDb } from './testing';

let testDb: TestDb;
beforeAll(async () => {
  testDb = await createTestDb();
});
afterAll(async () => {
  await testDb?.drop();
});

describe('achievement version migration', () => {
  it('keeps version one active until explicit activation', async () => {
    expect(await testDb.db.select().from(wordleAchievementVersions)).toEqual([
      { version: 1, active: true, activated_at: 0 },
    ]);
    expect(await testDb.db.select().from(wordlePatternDiscoveries)).toEqual([]);
  });

  it('enforces a single active version', async () => {
    await expect(async () => {
      await testDb.db.insert(wordleAchievementVersions).values({
        version: 2,
        active: true,
        activated_at: 1,
      });
    }).toThrow();
  });
});
