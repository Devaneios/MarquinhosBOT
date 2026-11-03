import { getAlbum } from '@marquinhos/contracts/http/routes/wordle';
import {
  wordleAlbumMilestones,
  wordleCommunityDailyPresence,
  wordleGlobalOccurrences,
} from '@marquinhos/database/schema';
import { createTestDb, type TestDb } from '@marquinhos/database/testing';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { and, eq } from 'drizzle-orm';
import { WordleAlbumService } from '../src/services/wordle/WordleAlbumService';
import { recordWordlePresence } from '../src/services/wordle/WordleCommunityService';

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
      pattern_id: 'letter_a',
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
  it('builds catalog pages without exposing session evidence', async () => {
    await testDb.db.insert(wordleAlbumMilestones).values({
      guild_id: 'a',
      family: 'letters',
      pattern_ids: ['letter_a'],
      completed_at: 10,
      revised_at: null,
      status: 'completed',
    });
    const pages = await album.pages('a');
    expect(pages.length).toBeGreaterThan(0);
    expect(pages.some((page) => page.patternId === 'letter_a')).toBe(true);
    expect(
      pages.find((page) => page.patternId === 'letter_a')?.contributors,
    ).toEqual(['player']);
    expect(
      pages.find((page) => page.patternId === 'letter_a')?.familyMilestone
        ?.status,
    ).toBe('completed');
    expect(JSON.stringify(pages)).not.toContain('evidence');
    expect(getAlbum.response.safeParse({ data: pages }).success).toBe(true);
  });
  it('handles late presence and removes projections when the source is deleted', async () => {
    await recordWordlePresence(testDb.db, 'player', 'late', '2026-10-01', 4);
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
          eq(wordleGlobalOccurrences.pattern_id, 'letter_a'),
        ),
      );
    expect(await album.contributions('late')).toEqual([]);
    expect(await album.contributions('a')).toEqual([]);
    await album.reconcile();
    expect(await album.contributions('a')).toEqual([]);
  });
});
