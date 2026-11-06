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
  now = 100;
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
      recorded_at_ms: 100,
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

it('does not add a participant who first visits the community after the challenge closes', async () => {
  now = 1000;
  const invite = await challenges.create(
    'late-visit',
    'owner',
    'letter_a',
    2000,
  );
  await challenges.join(invite.id, 'late-visit', 'visitor');
  await testDb.db.insert(wordleGlobalOccurrences).values({
    user_id: 'visitor',
    word_date: '2026-10-02',
    pattern_id: 'letter_a',
    session_id: 'other-community',
    occurred_at: 1500,
    source_at: 1500,
    evidence: {},
  });
  now = 2001;
  await testDb.db.insert(wordleCommunityDailyPresence).values({
    guild_id: 'late-visit',
    user_id: 'visitor',
    word_date: '2026-10-02',
    first_seen_at: 2,
    recorded_at_ms: now,
  });
  expect((await challenges.get(invite.id, 'late-visit')).participants).toEqual(
    [],
  );
});

it('limits simultaneous creations by the same member in one community', async () => {
  now = 3000;
  const created = await Promise.allSettled(
    Array.from({ length: 4 }, () =>
      challenges.create('creation-limit', 'owner', 'letter_a', 4000),
    ),
  );
  expect(
    created.filter((result) => result.status === 'fulfilled'),
  ).toHaveLength(3);
  expect(await challenges.list('creation-limit')).toHaveLength(3);
});
