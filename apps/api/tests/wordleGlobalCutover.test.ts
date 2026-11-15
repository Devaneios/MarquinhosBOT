import {
  wordleCommunityParticipation,
  wordleDays,
  wordleGlobalCutovers,
  wordleGlobalDays,
  wordleGlobalSessions,
  wordleLegacyProgress,
  wordleSessions,
  wordleStreaks,
  wordleUsedWords,
} from '@marquinhos/database/schema';
import { createTestDb, type TestDb } from '@marquinhos/database/testing';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import { prepareGlobalWordleCutover } from '../src/modules/wordle/migration/global-cutover';
import { auditWordlePreservation } from '../src/modules/wordle/migration/wordle-preservation';

let testDb: TestDb;
beforeEach(async () => {
  testDb = await createTestDb();
});
afterEach(async () => {
  await testDb.drop();
});

async function seedLegacy() {
  await testDb.db.insert(wordleDays).values([
    {
      guild_id: 'g1',
      word_date: '2026-11-09',
      word: null,
      word_length: null,
      is_legacy: true,
      created_at: 100,
    },
    {
      guild_id: 'g2',
      word_date: '2026-11-09',
      word: null,
      word_length: null,
      is_legacy: true,
      created_at: 101,
    },
  ]);
  await testDb.db.insert(wordleSessions).values([
    {
      id: 's1',
      user_id: 'u1',
      guild_id: 'g1',
      word_date: '2026-11-09',
      guesses: '[]',
      solved: true,
      attempts: 0,
      solved_from_draft: true,
      created_at: 100,
      solved_at: null,
      first_solver: null,
    },
    {
      id: 's2',
      user_id: 'u1',
      guild_id: 'g2',
      word_date: '2026-11-09',
      guesses: '[]',
      solved: false,
      attempts: 0,
      created_at: 101,
      solved_at: null,
      first_solver: null,
    },
  ]);
  await testDb.db.insert(wordleStreaks).values([
    {
      user_id: 'u1',
      guild_id: 'g1',
      current_streak: 8,
      max_streak: 20,
      last_solved_date: '2026-11-09',
    },
    {
      user_id: 'u1',
      guild_id: 'g2',
      current_streak: 4,
      max_streak: 10,
      last_solved_date: '2026-11-08',
    },
  ]);
  await testDb.db
    .insert(wordleUsedWords)
    .values({ word: 'crane', used_at: 100 });
}

describe('global Wordle cutover preparation', () => {
  test('retains distinct same-day legacy games without inventing global boards', async () => {
    await seedLegacy();
    const before = await auditWordlePreservation(testDb.db);
    const dry = await prepareGlobalWordleCutover(testDb.db, {
      sourceTag: 'v0.0.3',
      cutoverDate: '2026-11-10',
      dryRun: true,
      before,
    });
    expect(dry.status).toBe('dry-run');
    expect(await testDb.db.select().from(wordleGlobalCutovers)).toHaveLength(0);
    expect(await testDb.db.select().from(wordleLegacyProgress)).toHaveLength(0);
    expect(await testDb.db.select().from(wordleGlobalSessions)).toHaveLength(0);
    const applied = await prepareGlobalWordleCutover(testDb.db, {
      sourceTag: 'v0.0.3',
      cutoverDate: '2026-11-10',
      dryRun: false,
      before,
    });
    expect(applied.status).toBe('prepared');
    expect(await testDb.db.select().from(wordleGlobalDays)).toHaveLength(0);
    expect(await testDb.db.select().from(wordleGlobalSessions)).toHaveLength(0);
    expect(
      await testDb.db.select().from(wordleCommunityParticipation),
    ).toMatchObject([
      { guild_id: 'g1', user_id: 'u1', first_seen_at: 100, last_seen_at: 100 },
      { guild_id: 'g2', user_id: 'u1', first_seen_at: 101, last_seen_at: 101 },
    ]);
    expect(await testDb.db.select().from(wordleSessions)).toHaveLength(2);
    expect(await testDb.db.select().from(wordleLegacyProgress)).toMatchObject([
      {
        user_id: 'u1',
        current_streak: 8,
        best_streak: 20,
        last_solved_date: '2026-11-09',
      },
    ]);
    expect(
      await prepareGlobalWordleCutover(testDb.db, {
        sourceTag: 'v0.0.3',
        cutoverDate: '2026-11-10',
        before,
      }),
    ).toMatchObject({ status: 'already-prepared' });
    await expect(
      prepareGlobalWordleCutover(testDb.db, {
        sourceTag: 'v0.0.3',
        cutoverDate: '2026-11-11',
        before,
      }),
    ).rejects.toThrow('receipt does not match');
    expect(await testDb.db.select().from(wordleUsedWords)).toMatchObject([
      { word: 'crane', used_at: 100 },
    ]);
  });

  test('coalesces multi-day legacy participation by guild and player', async () => {
    await seedLegacy();
    await testDb.db.insert(wordleDays).values({
      guild_id: 'g1',
      word_date: '2026-11-08',
      word: null,
      word_length: null,
      is_legacy: true,
      created_at: 80,
    });
    await testDb.db.insert(wordleSessions).values({
      id: 's0',
      user_id: 'u1',
      guild_id: 'g1',
      word_date: '2026-11-08',
      guesses: '[]',
      solved: false,
      attempts: 0,
      created_at: 80,
    });
    const before = await auditWordlePreservation(testDb.db);
    await prepareGlobalWordleCutover(testDb.db, {
      sourceTag: 'v0.0.3',
      cutoverDate: '2026-11-10',
      before,
    });
    const participation = await testDb.db
      .select()
      .from(wordleCommunityParticipation);
    expect(participation).toHaveLength(2);
    expect(participation.find((row) => row.guild_id === 'g1')).toMatchObject({
      first_seen_at: 80,
      last_seen_at: 100,
    });
  });

  test('blocks malformed sessions recorded in the inventory', async () => {
    await seedLegacy();
    await testDb.db
      .update(wordleSessions)
      .set({ guesses: 'not-json' })
      .where(sql`id = 's1'`);
    const before = await auditWordlePreservation(testDb.db);
    await expect(
      prepareGlobalWordleCutover(testDb.db, {
        sourceTag: 'v0.0.3',
        cutoverDate: '2026-11-10',
        before,
      }),
    ).rejects.toThrow('invalid_legacy_session');
    expect(await testDb.db.select().from(wordleGlobalCutovers)).toHaveLength(0);
  });

  test('blocks source drift and legacy activity at the cutoff boundary', async () => {
    await seedLegacy();
    const before = await auditWordlePreservation(testDb.db);
    await testDb.db
      .update(wordleSessions)
      .set({ guesses: '[\"changed\"]' })
      .where(sql`id = 's1'`);
    await expect(
      prepareGlobalWordleCutover(testDb.db, {
        sourceTag: 'v0.0.3',
        cutoverDate: '2026-11-10',
        before,
      }),
    ).rejects.toThrow('source changed');
    await testDb.db.insert(wordleDays).values({
      guild_id: 'g1',
      word_date: '2026-11-10',
      word: 'termo',
      word_length: 5,
      is_legacy: true,
      created_at: 200,
    });
    await testDb.db.insert(wordleSessions).values({
      id: 'late',
      user_id: 'u2',
      guild_id: 'g1',
      word_date: '2026-11-10',
      guesses: '[]',
      solved: false,
      attempts: 0,
      created_at: 200,
    });
    const freshInventory = await auditWordlePreservation(testDb.db);
    await expect(
      prepareGlobalWordleCutover(testDb.db, {
        sourceTag: 'v0.0.3',
        cutoverDate: '2026-11-10',
        before: freshInventory,
      }),
    ).rejects.toThrow('legacy_day_on_or_after_cutover');
    expect(await testDb.db.select().from(wordleGlobalCutovers)).toHaveLength(0);
  });

  test('rolls all projections back if the final receipt write fails', async () => {
    await seedLegacy();
    const before = await auditWordlePreservation(testDb.db);
    await testDb.db.execute(
      sql.raw(
        `CREATE FUNCTION fail_wordle_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'receipt failure'; END $$`,
      ),
    );
    await testDb.db.execute(
      sql.raw(
        `CREATE TRIGGER fail_wordle_receipt BEFORE INSERT ON wordle_global_cutovers FOR EACH ROW EXECUTE FUNCTION fail_wordle_receipt()`,
      ),
    );
    await expect(
      prepareGlobalWordleCutover(testDb.db, {
        sourceTag: 'v0.0.3',
        cutoverDate: '2026-11-10',
        before,
      }),
    ).rejects.toThrow();
    expect(await testDb.db.select().from(wordleLegacyProgress)).toHaveLength(0);
    expect(
      await testDb.db.execute(
        sql`SELECT count(*)::int AS n FROM wordle_community_participation`,
      ),
    ).toMatchObject([{ n: 0 }]);
    expect(await testDb.db.select().from(wordleGlobalCutovers)).toHaveLength(0);
  });
});
