import {
  wordleGlobalDays,
  wordleGlobalSessions,
} from '@marquinhos/database/schema';
import { createTestDb, type TestDb } from '@marquinhos/database/testing';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { recordWordlePresence } from '../src/services/wordle/WordleCommunityService';
import { WordleGlobalLeaderboardService } from '../src/services/wordle/WordleGlobalLeaderboardService';

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
  await recordWordlePresence(testDb.db, 'b', 'community', '2026-11-01', first);
  await recordWordlePresence(
    testDb.db,
    'a',
    'community',
    '2026-11-02',
    first + 86400,
  );
  await recordWordlePresence(
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
});
