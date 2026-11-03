import {
  wordleCommunityDailyPresence,
  wordleGlobalOccurrences,
} from '@marquinhos/database/schema';
import { createTestDb, type TestDb } from '@marquinhos/database/testing';
import { afterAll, beforeAll, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { WordleAlbumMilestoneService } from '../src/services/wordle/WordleAlbumMilestoneService';
import { WordleAlbumService } from '../src/services/wordle/WordleAlbumService';

let testDb: TestDb;
beforeAll(async () => {
  testDb = await createTestDb();
});
afterAll(async () => {
  await testDb.drop();
});

it('keeps a family milestone across retries and catalog growth and revises it after deletion', async () => {
  const presence = {
    guild_id: 'guild',
    user_id: 'user',
    word_date: '2026-10-01',
    first_seen_at: 1,
  };
  await testDb.db.insert(wordleCommunityDailyPresence).values(presence);
  await testDb.db.insert(wordleGlobalOccurrences).values(
    ['a', 'b'].map((pattern_id) => ({
      user_id: 'user',
      word_date: '2026-10-01',
      pattern_id,
      session_id: 'session',
      occurred_at: 1,
      evidence: {},
    })),
  );
  await new WordleAlbumService(testDb.db).reconcile('guild');
  let now = 100;
  const service = new WordleAlbumMilestoneService(testDb.db, () => now);
  const first = await service.reconcile('guild', [
    { patternId: 'a', family: 'letters' },
    { patternId: 'b', family: 'letters' },
  ]);
  expect(first).toEqual([
    {
      family: 'letters',
      patternIds: ['a', 'b'],
      completedAt: 100,
      revisedAt: null,
      status: 'completed',
    },
  ]);
  now = 200;
  expect(
    await service.reconcile('guild', [
      { patternId: 'a', family: 'letters' },
      { patternId: 'b', family: 'letters' },
      { patternId: 'c', family: 'letters' },
    ]),
  ).toEqual(first);
  await testDb.db
    .delete(wordleGlobalOccurrences)
    .where(eq(wordleGlobalOccurrences.pattern_id, 'a'));
  now = 300;
  expect(
    await service.reconcile('guild', [
      { patternId: 'a', family: 'letters' },
      { patternId: 'b', family: 'letters' },
    ]),
  ).toEqual([{ ...first[0]!, status: 'revised', revisedAt: 300 }]);
});
