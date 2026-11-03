import {
  wordleCommunityDailyPresence,
  wordleCommunityParticipation,
  wordleGlobalDays,
  wordleGlobalSessions,
} from '@marquinhos/database/schema';
import { createTestDb, type TestDb } from '@marquinhos/database/testing';
import { afterAll, beforeAll, describe, expect, it, spyOn } from 'bun:test';
import { WordleAlbumService } from '../src/services/wordle/WordleAlbumService';
import { recordWordlePresence } from '../src/services/wordle/WordleCommunityService';
import { WordleGlobalAchievementService } from '../src/services/wordle/WordleGlobalAchievementService';

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
  it('projects the album only when a community or occurrence is new', async () => {
    const pages = spyOn(WordleAlbumService.prototype, 'pages');
    try {
      await recordWordlePresence(testDb.db, 'repeat', 'r', '2026-11-05', 1);
      await recordWordlePresence(testDb.db, 'repeat', 'r', '2026-11-05', 2);
      expect(pages).toHaveBeenCalledTimes(1);

      await testDb.db.insert(wordleGlobalDays).values({
        word_date: '2026-11-05',
        word: 'termo',
        word_length: 5,
        created_at: 1,
      });
      await testDb.db.insert(wordleGlobalSessions).values({
        id: 'repeat-session',
        user_id: 'repeat',
        word_date: '2026-11-05',
        attempts: 1,
        created_at: 1,
        guesses: JSON.stringify([
          {
            guess: 'terma',
            feedback: ['correct', 'correct', 'correct', 'correct', 'absent'],
          },
        ]),
      });
      const awards = new WordleGlobalAchievementService(testDb.db, () =>
        Date.parse('2026-11-05T15:00:00Z'),
      );
      pages.mockClear();
      await awards.checkAndAward('repeat', 'r');
      expect(pages).toHaveBeenCalledTimes(1);
      await awards.checkAndAward('repeat', 'r');
      expect(pages).toHaveBeenCalledTimes(1);
    } finally {
      pages.mockRestore();
    }
  });
});
