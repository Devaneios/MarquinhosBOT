import {
  wordleDays,
  wordleGlobalCutovers,
  wordleGlobalDays,
  wordleGlobalSessions,
  wordleSessions,
} from '@marquinhos/database/schema';
import { createTestDb, type TestDb } from '@marquinhos/database/testing';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { inArray } from 'drizzle-orm';
import { WordleGlobalLeaderboardService } from '../src/modules/wordle/services/wordle-global-leaderboard.service';
import { createWordleTestPresence } from './helpers/wordleServices';

let testDb: TestDb;
const first = Math.floor(Date.parse('2026-11-01T15:00:00Z') / 1000);
beforeAll(async () => {
  testDb = await createTestDb();
  await testDb.db.insert(wordleGlobalDays).values([
    {
      word_date: '2026-11-01',
      word: 'termo',
      word_length: 5,
      created_at: first,
    },
    {
      word_date: '2026-11-02',
      word: 'carta',
      word_length: 5,
      created_at: first + 86400,
    },
  ]);
  await testDb.db.insert(wordleGlobalSessions).values([
    {
      id: 'a-old',
      user_id: 'a',
      word_date: '2026-11-01',
      solved: true,
      attempts: 1,
      created_at: first,
    },
    {
      id: 'a-today',
      user_id: 'a',
      word_date: '2026-11-02',
      solved: true,
      attempts: 1,
      created_at: first + 86400,
    },
    {
      id: 'b-old',
      user_id: 'b',
      word_date: '2026-11-01',
      solved: true,
      attempts: 2,
      created_at: first,
    },
    {
      id: 'c-today',
      user_id: 'c',
      word_date: '2026-11-02',
      solved: true,
      attempts: 1,
      created_at: first + 86400,
    },
  ]);
  await createWordleTestPresence(
    testDb.db,
    'b',
    'community',
    '2026-11-01',
    first,
  );
  await createWordleTestPresence(
    testDb.db,
    'a',
    'community',
    '2026-11-02',
    first + 86400,
  );
  await createWordleTestPresence(
    testDb.db,
    'c',
    'other',
    '2026-11-02',
    first + 86400,
  );
});
afterAll(async () => {
  await testDb.drop();
});

describe('global community rankings', () => {
  it('supports stable pages so the bot can skip departed members', async () => {
    await createWordleTestPresence(
      testDb.db,
      'a',
      'paged',
      '2026-11-02',
      first + 86400,
    );
    await createWordleTestPresence(
      testDb.db,
      'c',
      'paged',
      '2026-11-02',
      first + 86400,
    );
    const service = new WordleGlobalLeaderboardService(testDb.db);
    const page1 = await service.getLeaderboard(
      'paged',
      'daily',
      '2026-11-02',
      1,
      0,
    );
    const page2 = await service.getLeaderboard(
      'paged',
      'daily',
      '2026-11-02',
      1,
      1,
    );
    expect(page1.map((entry) => entry.userId)).toEqual(['a']);
    expect(page2.map((entry) => entry.userId)).toEqual(['c']);
  });
  it('shows only players present in the requested community on the date', async () => {
    const service = new WordleGlobalLeaderboardService(testDb.db);
    expect(
      await service.getLeaderboard('community', 'daily', '2026-11-02', 10),
    ).toEqual([{ userId: 'a', attempts: 1, solved: true }]);
    expect(
      await service.getLeaderboard('other', 'daily', '2026-11-02', 10),
    ).toEqual([{ userId: 'c', attempts: 1, solved: true }]);
  });
  it('counts only dates after a player joined the community', async () => {
    const service = new WordleGlobalLeaderboardService(testDb.db);
    expect(
      await service.getLeaderboard('community', 'weekly', '2026-11-02', 10),
    ).toEqual([
      { userId: 'a', totalDays: 1, avgScore: 1 },
      { userId: 'b', totalDays: 2, avgScore: 4 },
    ]);
  });

  it('computes group streak from local days with actual sessions', async () => {
    const service = new WordleGlobalLeaderboardService(testDb.db);
    expect(await service.getGroupStreak('community', '2026-11-02')).toBe(1);
    expect(await service.getGroupStreak('other', '2026-11-02')).toBe(0);
  });
  it('combines guild history before cutover with global scores after cutover', async () => {
    await testDb.db
      .delete(wordleGlobalSessions)
      .where(inArray(wordleGlobalSessions.id, ['a-old', 'b-old']));
    await testDb.db
      .insert(wordleGlobalCutovers)
      .values({
        id: 'global-only-v003',
        source_tag: 'v0.0.3',
        cutover_date: '2026-11-02',
        source_digest: 'a'.repeat(64),
        verified_at: first,
        completed_at: first,
      });
    await testDb.db
      .insert(wordleDays)
      .values({
        guild_id: 'community',
        word_date: '2026-11-01',
        word: 'termo',
        word_length: 5,
        is_legacy: true,
        created_at: first,
      });
    await testDb.db.insert(wordleSessions).values([
      {
        id: 'legacy-a',
        user_id: 'a',
        guild_id: 'community',
        word_date: '2026-11-01',
        guesses: '[]',
        solved: true,
        attempts: 1,
        created_at: first,
        word_length: 5,
      },
      {
        id: 'legacy-b',
        user_id: 'b',
        guild_id: 'community',
        word_date: '2026-11-01',
        guesses: '[]',
        solved: true,
        attempts: 2,
        created_at: first,
        word_length: 5,
      },
    ]);
    await createWordleTestPresence(
      testDb.db,
      'a',
      'community',
      '2026-11-01',
      first,
    );
    await createWordleTestPresence(
      testDb.db,
      'b',
      'community',
      '2026-11-01',
      first,
    );
    const service = new WordleGlobalLeaderboardService(testDb.db);
    expect(
      await service.getLeaderboard('community', 'daily', '2026-11-01', 10),
    ).toEqual([
      { userId: 'a', attempts: 1, solved: true },
      { userId: 'b', attempts: 2, solved: true },
    ]);
    expect(
      await service.getLeaderboard('community', 'weekly', '2026-11-02', 10),
    ).toEqual([
      { userId: 'a', totalDays: 2, avgScore: 1 },
      { userId: 'b', totalDays: 2, avgScore: 4 },
    ]);
    expect(await service.getGroupStreak('community', '2026-11-03')).toBe(2);
  });
});
