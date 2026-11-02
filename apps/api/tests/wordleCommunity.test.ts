import {
  wordleCommunityDailyPresence,
  wordleCommunityParticipation,
} from '@marquinhos/database/schema';
import { createTestDb, type TestDb } from '@marquinhos/database/testing';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { recordWordlePresence } from '../src/services/wordle/WordleCommunityService';

let testDb: TestDb;
beforeAll(async () => {
  testDb = await createTestDb();
});
afterAll(async () => {
  await testDb.drop();
});

describe('community participation', () => {
  it('records opening in each community once per day and keeps first and last activity', async () => {
    await Promise.all([
      recordWordlePresence(testDb.db, 'player', 'a', '2026-11-01', 100),
      recordWordlePresence(testDb.db, 'player', 'a', '2026-11-01', 200),
      recordWordlePresence(testDb.db, 'player', 'b', '2026-11-01', 150),
    ]);
    await recordWordlePresence(testDb.db, 'player', 'a', '2026-11-02', 300);
    const members = await testDb.db.select().from(wordleCommunityParticipation);
    const days = await testDb.db.select().from(wordleCommunityDailyPresence);
    expect(members).toHaveLength(2);
    expect(days).toHaveLength(3);
    expect(members.find((row) => row.guild_id === 'a')).toMatchObject({
      first_seen_at: 100,
      last_seen_at: 300,
    });
    expect(
      days.find((row) => row.guild_id === 'a' && row.word_date === '2026-11-01')
        ?.first_seen_at,
    ).toBe(100);
  });
});
