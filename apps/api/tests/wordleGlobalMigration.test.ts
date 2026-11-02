import {
  achievements,
  userAchievements,
  userLevels,
  wordleCommunityDailyPresence,
  wordleDays,
  wordleDrafts,
  wordleGlobalAchievements,
  wordleGlobalDays,
  wordleGlobalDiscoveries,
  wordleGlobalSessions,
  wordlePatternDiscoveries,
  wordleSessions,
} from '@marquinhos/database/schema';
import { createTestDb, type TestDb } from '@marquinhos/database/testing';
import { matchWordlePatterns } from '@marquinhos/domain/games/wordle/achievements/engine/matchPatterns';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { sql } from 'drizzle-orm';
import { migrateGlobalWordle } from '../src/services/wordle/WordleGlobalMigrationService';

let testDb: TestDb;
beforeEach(async () => {
  testDb = await createTestDb();
});
afterEach(async () => {
  await testDb.drop();
});

async function seed(answerB = 'termo') {
  await testDb.db.insert(wordleDays).values([
    {
      guild_id: 'a',
      word_date: '2026-01-01',
      word: 'termo',
      word_length: 5,
      created_at: 100,
    },
    {
      guild_id: 'b',
      word_date: '2026-01-01',
      word: answerB,
      word_length: 5,
      created_at: 101,
    },
  ]);
  await testDb.db.insert(wordleSessions).values([
    {
      id: 's1',
      user_id: 'u',
      guild_id: 'a',
      word_date: '2026-01-01',
      guesses: '[]',
      attempts: 0,
      created_at: 100,
    },
    {
      id: 's2',
      user_id: 'u',
      guild_id: 'b',
      word_date: '2026-01-01',
      guesses: '[]',
      attempts: 0,
      created_at: 101,
    },
  ]);
  await testDb.db.insert(achievements).values({
    id: 'wordle-example',
    name: 'Example',
    description: 'Example',
    category: 'wordle',
    rarity: 'common',
    icon: 'x',
    reward_xp: 25,
  });
  await testDb.db.insert(userAchievements).values([
    {
      user_id: 'u',
      guild_id: 'a',
      achievement_id: 'wordle-example',
      unlocked_at: 10,
    },
    {
      user_id: 'u',
      guild_id: 'b',
      achievement_id: 'wordle-example',
      unlocked_at: 20,
    },
  ]);
  await testDb.db.insert(userLevels).values([
    { user_id: 'u', guild_id: 'a', total_xp: 100 },
    { user_id: 'u', guild_id: 'b', total_xp: 150 },
  ]);
}

describe('global Wordle migration', () => {
  it('rolls back a dry run without changing source or destination', async () => {
    await seed();
    expect(await migrateGlobalWordle(testDb.db, { dryRun: true })).toEqual({
      alreadyMigrated: false,
      dryRun: true,
    });
    expect(await testDb.db.select().from(wordleGlobalSessions)).toHaveLength(0);
    expect(await testDb.db.select().from(wordleSessions)).toHaveLength(2);
    expect(await migrateGlobalWordle(testDb.db)).toEqual({
      alreadyMigrated: false,
      dryRun: false,
    });
  });
  it('consolidates equivalent sessions, keeps source mapping and preserves XP on retry', async () => {
    await seed();
    await migrateGlobalWordle(testDb.db);
    await migrateGlobalWordle(testDb.db);
    expect(await testDb.db.select().from(wordleGlobalDays)).toHaveLength(1);
    expect(await testDb.db.select().from(wordleGlobalSessions)).toHaveLength(1);
    expect(
      await testDb.db.select().from(wordleGlobalAchievements),
    ).toMatchObject([{ user_id: 'u', unlocked_at: 10 }]);
    expect(
      await testDb.db.select().from(wordleCommunityDailyPresence),
    ).toHaveLength(2);
    const origins = await testDb.db.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM wordle_global_session_origins`,
    );
    expect(origins[0]?.n).toBe(2);
    expect(
      (await testDb.db.select().from(userLevels))
        .map((row) => row.total_xp)
        .sort(),
    ).toEqual([100, 150]);
    expect(await testDb.db.select().from(wordleSessions)).toHaveLength(2);
  });

  it('rolls back all target rows when historical daily words conflict', async () => {
    await seed('barco');
    await expect(migrateGlobalWordle(testDb.db)).rejects.toThrow(
      'conflicting_days',
    );
    expect(await testDb.db.select().from(wordleGlobalDays)).toHaveLength(0);
    expect(await testDb.db.select().from(wordleGlobalSessions)).toHaveLength(0);
    expect(
      await testDb.db.select().from(wordleGlobalAchievements),
    ).toHaveLength(0);
  });

  it('refuses to replay after the legacy source changes', async () => {
    await seed();
    await migrateGlobalWordle(testDb.db);
    await testDb.db.update(wordleDays).set({ players_count: 1 });
    await expect(migrateGlobalWordle(testDb.db)).rejects.toThrow(
      'source changed',
    );
    expect(await testDb.db.select().from(wordleGlobalSessions)).toHaveLength(1);
  });

  it('does not migrate conflicting drafts or award records partially', async () => {
    await seed();
    await testDb.db.insert(wordleDrafts).values([
      {
        user_id: 'u',
        guild_id: 'a',
        word_date: '2026-01-01',
        row_index: 0,
        cells: ['t', '', '', '', ''],
        active_index: 1,
        revision: 1,
        updated_at: 100,
      },
      {
        user_id: 'u',
        guild_id: 'b',
        word_date: '2026-01-01',
        row_index: 0,
        cells: ['c', '', '', '', ''],
        active_index: 1,
        revision: 1,
        updated_at: 100,
      },
    ]);
    await expect(migrateGlobalWordle(testDb.db)).rejects.toThrow(
      'conflicting_drafts',
    );
    expect(await testDb.db.select().from(wordleGlobalSessions)).toHaveLength(0);
    expect(
      await testDb.db.select().from(wordleGlobalAchievements),
    ).toHaveLength(0);
  });

  it('preserves the earliest valid drawing evidence and its source', async () => {
    await seed();
    const feedback = [
      ['correct', 'correct', 'correct', 'correct', 'absent'],
    ] as const;
    const match = matchWordlePatterns(feedback).find(
      (row) => row.patternId === 'tetromino_i',
    );
    expect(match).toBeDefined();
    const guesses = JSON.stringify([{ guess: 'terma', feedback: feedback[0] }]);
    await testDb.db.update(wordleSessions).set({ guesses, attempts: 1 });
    await testDb.db.insert(wordlePatternDiscoveries).values([
      {
        user_id: 'u',
        guild_id: 'b',
        pattern_id: 'tetromino_i',
        session_id: 's2',
        discovered_at: 20,
        evidence: { ...match!, feedback, date: '2026-01-01' },
      },
      {
        user_id: 'u',
        guild_id: 'a',
        pattern_id: 'tetromino_i',
        session_id: 's1',
        discovered_at: 10,
        evidence: { ...match!, feedback, date: '2026-01-01' },
      },
    ]);
    await migrateGlobalWordle(testDb.db);
    const discoveries = await testDb.db.select().from(wordleGlobalDiscoveries);
    expect(discoveries).toHaveLength(1);
    expect(discoveries[0]).toMatchObject({
      pattern_id: 'tetromino_i',
      session_id: 's1',
      discovered_at: 10,
    });
  });

  it('does not trust an evidence snapshot that disagrees with its source session', async () => {
    await seed();
    const feedback = [
      ['correct', 'correct', 'correct', 'correct', 'absent'],
    ] as const;
    const match = matchWordlePatterns(feedback).find(
      (row) => row.patternId === 'tetromino_i',
    )!;
    await testDb.db.update(wordleSessions).set({
      guesses: JSON.stringify([
        {
          guess: 'terma',
          feedback: ['absent', 'absent', 'absent', 'absent', 'absent'],
        },
      ]),
      attempts: 1,
    });
    await testDb.db.insert(wordlePatternDiscoveries).values({
      user_id: 'u',
      guild_id: 'a',
      pattern_id: 'tetromino_i',
      session_id: 's1',
      discovered_at: 10,
      evidence: { ...match, feedback, date: '2026-01-01' },
    });
    await migrateGlobalWordle(testDb.db);
    expect(await testDb.db.select().from(wordleGlobalDiscoveries)).toHaveLength(
      0,
    );
    expect(
      await testDb.db.select().from(wordlePatternDiscoveries),
    ).toHaveLength(1);
  });
});
