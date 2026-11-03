import {
  wordleCommunityDailyPresence,
  wordleGlobalAcceptedGuesses,
  wordleGlobalDays,
  wordleGlobalSessions,
  wordleGoalAwards,
  wordleGoalDecorations,
} from '@marquinhos/database/schema';
import { createTestDb, type TestDb } from '@marquinhos/database/testing';
import { afterAll, beforeAll, expect, it } from 'bun:test';
import { sql } from 'drizzle-orm';
import { WordleGoalsService } from '../src/services/wordle/WordleGoalsService';
import { lockGoalFactsForWrite } from '../src/services/wordle/goalFactLock';

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
      recorded_at_ms: 0,
    },
    {
      guild_id: 'b',
      user_id: 'two',
      word_date: '2026-10-01',
      first_seen_at: 0,
      recorded_at_ms: 0,
    },
    {
      guild_id: 'b',
      user_id: 'one',
      word_date: '2026-10-01',
      first_seen_at: 0,
      recorded_at_ms: 0,
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

it('prevents closing while a fact writer is still in flight', async () => {
  await testDb.db.transaction(async (writer) => {
    await lockGoalFactsForWrite(writer);
    await testDb.db.transaction(async (closer) => {
      const rows = await closer.execute<{ acquired: boolean }>(
        sql`SELECT pg_try_advisory_xact_lock(hashtextextended('wordle-goal-facts', 0)) AS acquired`,
      );
      expect(rows[0]?.acquired).toBe(false);
    });
  });
  await testDb.db.transaction(async (closer) => {
    const rows = await closer.execute<{ acquired: boolean }>(
      sql`SELECT pg_try_advisory_xact_lock(hashtextextended('wordle-goal-facts', 0)) AS acquired`,
    );
    expect(rows[0]?.acquired).toBe(true);
  });
});

it('closes only after the deadline, snapshots eligible facts and grants rewards once', async () => {
  let now = 100;
  const goals = new WordleGoalsService(testDb.db, () => now);
  const goal = await goals.create('a', 1, 200, 500);
  await expect(goals.close(goal.id, 'a')).rejects.toThrow();
  now = 500;
  expect(await goals.close(goal.id, 'a')).toMatchObject({
    status: 'completed',
  });
  expect(await goals.close(goal.id, 'a')).toMatchObject({
    status: 'completed',
  });
  expect(
    (await testDb.db.select().from(wordleGoalAwards))
      .filter((row) => row.goal_id === goal.id)
      .map((row) => row.user_id),
  ).toEqual(['one']);
  expect(
    (await testDb.db.select().from(wordleGoalDecorations)).filter(
      (row) => row.goal_id === goal.id,
    ),
  ).toHaveLength(1);
  const empty = await goals.create('empty', 1, 600, 700);
  now = 700;
  expect(await goals.close(empty.id, 'empty')).toMatchObject({
    status: 'expired',
  });
  expect(
    (await testDb.db.select().from(wordleGoalDecorations)).filter(
      (row) => row.goal_id === empty.id,
    ),
  ).toHaveLength(0);
});

it('waits for an in-flight accepted fact before closing', async () => {
  let now = 100;
  const goals = new WordleGoalsService(testDb.db, () => now);
  const goal = await goals.create('race', 1, 200, 500);
  await testDb.db.insert(wordleGlobalSessions).values({
    id: 's3',
    user_id: 'three',
    word_date: '2026-10-01',
    created_at: 1,
  });
  await testDb.db.insert(wordleCommunityDailyPresence).values({
    guild_id: 'race',
    user_id: 'three',
    word_date: '2026-10-01',
    first_seen_at: 0,
    recorded_at_ms: 0,
  });
  let release!: () => void;
  let ready!: () => void;
  const entered = new Promise<void>((resolve) => {
    ready = resolve;
  });
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  const writer = testDb.db.transaction(async (tx) => {
    await lockGoalFactsForWrite(tx);
    await tx.insert(wordleGlobalAcceptedGuesses).values({
      session_id: 's3',
      user_id: 'three',
      word_date: '2026-10-01',
      attempt: 1,
      accepted_at: 250,
    });
    ready();
    await wait;
  });
  await entered;
  now = 500;
  const closing = goals.close(goal.id, 'race');
  const early = await Promise.race([
    closing.then(() => 'closed'),
    new Promise<string>((resolve) => setTimeout(() => resolve('waiting'), 30)),
  ]);
  expect(early).toBe('waiting');
  release();
  await writer;
  expect(await closing).toMatchObject({ status: 'completed' });
  expect(await goals.progress(goal.id, 'race')).toEqual({
    count: 1,
    contributors: ['three'],
  });
});
