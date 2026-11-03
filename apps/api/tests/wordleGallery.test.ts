import { getGallery } from '@marquinhos/contracts/http/routes/wordle';
import {
  wordleCommunityDailyPresence,
  wordleGlobalOccurrences,
  wordleNotifications,
} from '@marquinhos/database/schema';
import { createTestDb, type TestDb } from '@marquinhos/database/testing';
import { afterAll, beforeAll, expect, it } from 'bun:test';
import { WordleGalleryService } from '../src/services/wordle/WordleGalleryService';
import { WordleNotificationService } from '../src/services/wordle/WordleNotificationService';

let testDb: TestDb;
const now = Date.parse('2026-11-02T03:00:00Z');
beforeAll(async () => {
  testDb = await createTestDb();
});
afterAll(async () => {
  await testDb.drop();
});

it('shows one verified closed-day occurrence per person and never publishes an empty gallery', async () => {
  const service = new WordleGalleryService(testDb.db, () => now);
  expect((await service.previousWeek('empty')).entries).toEqual([]);
  const sourceAt = Date.parse('2026-11-01T15:00:00Z');
  const evidence = {
    patternId: 'tetromino_i',
    color: 'correct',
    origin: [0, 0],
    rotation: 0,
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
    ],
    feedback: [['correct', 'correct', 'correct', 'correct', 'absent']],
    date: '2026-11-01',
  };
  await testDb.db.insert(wordleGlobalOccurrences).values({
    user_id: 'player',
    word_date: '2026-11-01',
    pattern_id: 'tetromino_i',
    session_id: 'session',
    occurred_at: sourceAt,
    source_at: sourceAt,
    evidence,
  });
  await testDb.db.insert(wordleGlobalOccurrences).values({
    user_id: 'unverified',
    word_date: '2026-11-01',
    pattern_id: 'tetromino_i',
    session_id: 'old-session',
    occurred_at: sourceAt,
    source_at: null,
    evidence,
  });
  await testDb.db.insert(wordleCommunityDailyPresence).values({
    guild_id: 'a',
    user_id: 'player',
    word_date: '2026-11-01',
    first_seen_at: Math.floor(sourceAt / 1000),
    recorded_at_ms: sourceAt,
  });
  await testDb.db.insert(wordleCommunityDailyPresence).values({
    guild_id: 'a',
    user_id: 'unverified',
    word_date: '2026-11-01',
    first_seen_at: Math.floor(sourceAt / 1000),
    recorded_at_ms: sourceAt,
  });
  const gallery = await service.previousWeek('a');
  expect(gallery.weekKey).toBe('2026-10-26');
  expect(gallery.entries).toHaveLength(1);
  expect(getGallery.response.safeParse({ data: gallery }).success).toBe(true);
  expect(gallery.entries[0]).toMatchObject({
    userId: 'player',
    patternId: 'tetromino_i',
    date: '2026-11-01',
    evidence,
  });
  expect((await service.previousWeek('b')).entries).toEqual([]);
  expect((await service.forWeek('a', '2026-10-26')).entries).toHaveLength(1);
  await expect(service.forWeek('a', '2026-11-02')).rejects.toThrow();
  await new WordleNotificationService(testDb.db, () => now).configure('a', {
    channelId: null,
    collective: false,
    weekly: true,
  });
  expect(await service.queuePreviousWeek()).toBe(1);
  expect(await service.queuePreviousWeek()).toBe(0);
  expect(
    (await testDb.db.select().from(wordleNotifications)).filter(
      (item) => item.event_key === 'gallery:2026-10-26',
    ),
  ).toHaveLength(1);
});
