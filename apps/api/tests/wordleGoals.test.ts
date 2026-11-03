import {
  wordleCommunityDailyPresence,
  wordleGlobalAcceptedGuesses,
  wordleGlobalDays,
  wordleGlobalSessions,
} from '@marquinhos/database/schema';
import { createTestDb, type TestDb } from '@marquinhos/database/testing';
import { afterAll, beforeAll, expect, it } from 'bun:test';
import { WordleGoalsService } from '../src/services/wordle/WordleGoalsService';

let testDb: TestDb;
let service: WordleGoalsService;
beforeAll(async () => {
  testDb = await createTestDb();
  service = new WordleGoalsService(testDb.db, () => 100);
});

it('counts one accepted participation per player and date for each eligible community', async () => {
  const goal = await service.create('a', 2, 200, 500);
  const otherGoal = await service.create('b', 2, 200, 500);
  await testDb.db.insert(wordleGlobalDays).values({
    word_date: '2026-10-01',
    word: 'termo',
    word_length: 5,
    created_at: 1,
  });
  await testDb.db.insert(wordleGlobalSessions).values([
    { id: 's1', user_id: 'one', word_date: '2026-10-01', created_at: 1 },
    { id: 's2', user_id: 'two', word_date: '2026-10-01', created_at: 1 },
  ]);
  await testDb.db.insert(wordleGlobalAcceptedGuesses).values([
    {
      session_id: 's1',
      user_id: 'one',
      word_date: '2026-10-01',
      attempt: 1,
      accepted_at: 200,
    },
    {
      session_id: 's1',
      user_id: 'one',
      word_date: '2026-10-01',
      attempt: 2,
      accepted_at: 250,
    },
    {
      session_id: 's2',
      user_id: 'two',
      word_date: '2026-10-01',
      attempt: 1,
      accepted_at: 500,
    },
  ]);
  await testDb.db.insert(wordleCommunityDailyPresence).values([
    {
      guild_id: 'a',
      user_id: 'one',
      word_date: '2026-10-01',
      first_seen_at: 0,
    },
    {
      guild_id: 'b',
      user_id: 'two',
      word_date: '2026-10-01',
      first_seen_at: 0,
    },
    {
      guild_id: 'b',
      user_id: 'one',
      word_date: '2026-10-01',
      first_seen_at: 0,
    },
  ]);
  expect(await service.progress(goal.id, 'a')).toEqual({
    count: 1,
    contributors: ['one'],
  });
  expect(await service.progress(otherGoal.id, 'b')).toEqual({
    count: 1,
    contributors: ['one'],
  });
  await expect(service.progress(goal.id, 'b')).rejects.toThrow();
});
afterAll(async () => {
  await testDb.drop();
});

it('creates a goal with a fixed positive target and a future time window', async () => {
  await expect(service.create('guild', 0, 200, 300)).rejects.toThrow();
  await expect(service.create('guild', 1, 99, 300)).rejects.toThrow();
  await expect(service.create('guild', 1, 200, 200)).rejects.toThrow();
  const goal = await service.create('guild', 2, 200, 300);
  expect(goal).toMatchObject({
    guildId: 'guild',
    target: 2,
    startsAt: 200,
    endsAt: 300,
    status: 'scheduled',
  });
  expect(await service.list('guild')).toEqual([goal]);
  expect(await service.list('other')).toEqual([]);
});
