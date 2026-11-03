import {
  achievements,
  wordleCommunityDailyPresence,
  wordleGlobalAchievements,
  wordleGlobalOccurrences,
} from '@marquinhos/database/schema';
import { createTestDb, type TestDb } from '@marquinhos/database/testing';
import { afterAll, beforeAll, expect, it } from 'bun:test';
import { WordleChallengeService } from '../src/services/wordle/WordleChallengeService';

let testDb: TestDb;
let now = 100;
let challenges: WordleChallengeService;
beforeAll(async () => {
  testDb = await createTestDb();
  challenges = new WordleChallengeService(testDb.db, () => now);
  await testDb.db.insert(achievements).values({
    id: 'wordle_v2_pattern_letter_a',
    name: 'A',
    description: 'A',
    category: 'wordle',
    rarity: 'rare',
    icon: '🔤',
  });
  await testDb.db.insert(wordleGlobalAchievements).values({
    user_id: 'owner',
    achievement_id: 'wordle_v2_pattern_letter_a',
    unlocked_at: 1,
  });
});
afterAll(async () => {
  await testDb.drop();
});

it('allows a known figure, late entry and only verified occurrences during the invitation', async () => {
  await expect(
    challenges.create('a', 'unknown', 'letter_a', 300),
  ).rejects.toThrow();
  const invite = await challenges.create('a', 'owner', 'letter_a', 300);
  await testDb.db.insert(wordleGlobalOccurrences).values([
    {
      user_id: 'guest',
      word_date: '2026-10-01',
      pattern_id: 'letter_a',
      session_id: 'one',
      occurred_at: 400,
      source_at: 150,
      evidence: {},
    },
    {
      user_id: 'old',
      word_date: '2026-10-01',
      pattern_id: 'letter_a',
      session_id: 'two',
      occurred_at: 400,
      source_at: 99,
      evidence: {},
    },
  ]);
  await testDb.db.insert(wordleCommunityDailyPresence).values(
    ['guest', 'old'].map((user_id) => ({
      guild_id: 'a',
      user_id,
      word_date: '2026-10-01',
      first_seen_at: 1,
    })),
  );
  now = 200;
  await challenges.join(invite.id, 'a', 'guest');
  await challenges.join(invite.id, 'a', 'guest');
  expect((await challenges.get(invite.id, 'a', 'guest')).joined).toBe(true);
  await challenges.join(invite.id, 'a', 'old');
  expect((await challenges.get(invite.id, 'a')).participants).toEqual([
    'guest',
  ]);
  await expect(challenges.get(invite.id, 'b')).rejects.toThrow();
  now = 300;
  await expect(challenges.join(invite.id, 'a', 'late')).rejects.toThrow();
  expect((await challenges.get(invite.id, 'a')).status).toBe('closed');
});
