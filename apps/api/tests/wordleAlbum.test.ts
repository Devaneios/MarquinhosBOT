import {
  wordleCommunityDailyPresence,
  wordleGlobalOccurrences,
} from '@marquinhos/database/schema';
import { createTestDb, type TestDb } from '@marquinhos/database/testing';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { and, eq } from 'drizzle-orm';
import { WordleAlbumService } from '../src/services/wordle/WordleAlbumService';

let testDb: TestDb;
let album: WordleAlbumService;
beforeAll(async () => {
  testDb = await createTestDb();
  album = new WordleAlbumService(testDb.db);
});
afterAll(async () => {
  await testDb.drop();
});

describe('community album', () => {
  it('projects only same-day local presence, idempotently and independently in each community', async () => {
    await testDb.db.insert(wordleGlobalOccurrences).values({
      user_id: 'player',
      word_date: '2026-10-01',
      pattern_id: 'test-pattern',
      session_id: 'session',
      occurred_at: 100,
      evidence: {},
    });
    await testDb.db.insert(wordleCommunityDailyPresence).values([
      {
        guild_id: 'a',
        user_id: 'player',
        word_date: '2026-10-01',
        first_seen_at: 1,
      },
      {
        guild_id: 'b',
        user_id: 'player',
        word_date: '2026-10-01',
        first_seen_at: 2,
      },
      {
        guild_id: 'c',
        user_id: 'player',
        word_date: '2026-10-02',
        first_seen_at: 3,
      },
    ]);
    await album.reconcile();
    await album.reconcile();
    expect(
      (await album.contributions('a')).map((entry) => entry.userId),
    ).toEqual(['player']);
    expect(
      (await album.contributions('b')).map((entry) => entry.userId),
    ).toEqual(['player']);
    expect(await album.contributions('c')).toEqual([]);
  });
  it('handles late presence and removes projections when the source is deleted', async () => {
    await testDb.db.insert(wordleCommunityDailyPresence).values({
      guild_id: 'late',
      user_id: 'player',
      word_date: '2026-10-01',
      first_seen_at: 4,
    });
    expect(await album.contributions('late')).toEqual([]);
    await album.reconcile();
    expect(await album.contributions('late')).toHaveLength(1);
    await testDb.db
      .delete(wordleCommunityDailyPresence)
      .where(eq(wordleCommunityDailyPresence.guild_id, 'b'));
    expect(await album.contributions('b')).toEqual([]);
    await testDb.db
      .delete(wordleGlobalOccurrences)
      .where(
        and(
          eq(wordleGlobalOccurrences.user_id, 'player'),
          eq(wordleGlobalOccurrences.pattern_id, 'test-pattern'),
        ),
      );
    expect(await album.contributions('late')).toEqual([]);
    expect(await album.contributions('a')).toEqual([]);
    await album.reconcile();
    expect(await album.contributions('a')).toEqual([]);
  });
});
