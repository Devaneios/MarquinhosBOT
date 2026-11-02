import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import { runMigrations } from './migrate';
import {
  users,
  wordleCommunityDailyPresence,
  wordleCommunityParticipation,
  wordleGlobalAchievements,
  wordleGlobalDays,
  wordleGlobalDiscoveries,
  wordleGlobalDrafts,
  wordleGlobalOccurrences,
  wordleGlobalSessions,
  wordleShowcase,
  wordleUserConfig,
} from './schema';
import { createTestDb, type TestDb } from './testing';

let testDb: TestDb;

beforeAll(async () => {
  testDb = await createTestDb();
});

afterAll(async () => {
  await testDb.drop();
});

describe('baseline migrations', () => {
  test('stores global achievements once and permits repeat discoveries on different days', async () => {
    await testDb.db.execute(
      sql`INSERT INTO achievements (id, name, description, category, rarity, icon, reward_xp) VALUES ('achievement', 'test', 'test', 'wordle', 'common', 'x', 0)`,
    );
    await testDb.db.insert(wordleGlobalAchievements).values({
      user_id: 'collector',
      achievement_id: 'achievement',
      unlocked_at: 1,
    });
    await expect(
      testDb.db
        .insert(wordleGlobalAchievements)
        .values({
          user_id: 'collector',
          achievement_id: 'achievement',
          unlocked_at: 2,
        })
        .execute(),
    ).rejects.toThrow();
    await testDb.db.insert(wordleGlobalDiscoveries).values({
      user_id: 'collector',
      pattern_id: 'pattern',
      session_id: 'one',
      discovered_at: 1,
      evidence: { color: 'present' },
    });
    await expect(
      testDb.db
        .insert(wordleGlobalDiscoveries)
        .values({
          user_id: 'collector',
          pattern_id: 'pattern',
          session_id: 'two',
          discovered_at: 2,
          evidence: { color: 'correct' },
        })
        .execute(),
    ).rejects.toThrow();
    await testDb.db.insert(wordleGlobalOccurrences).values([
      {
        user_id: 'collector',
        word_date: '2026-11-01',
        pattern_id: 'pattern',
        session_id: 'one',
        occurred_at: 1,
        evidence: { color: 'present' },
      },
      {
        user_id: 'collector',
        word_date: '2026-11-02',
        pattern_id: 'pattern',
        session_id: 'two',
        occurred_at: 2,
        evidence: { color: 'correct' },
      },
    ]);
    const occurrences = await testDb.db.select().from(wordleGlobalOccurrences);
    expect(occurrences).toHaveLength(2);
  });
  test('keeps one global draft per player and date', async () => {
    const draft = {
      user_id: 'draft-player',
      word_date: '2026-11-02',
      row_index: 0,
      cells: ['t', '', '', '', ''],
      active_index: 1,
      revision: 1,
      updated_at: 1,
    };
    await testDb.db.insert(wordleGlobalDrafts).values(draft);
    await expect(
      testDb.db.insert(wordleGlobalDrafts).values(draft).execute(),
    ).rejects.toThrow();
    const rows = await testDb.db.select().from(wordleGlobalDrafts);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.cells).toEqual(draft.cells);
  });

  test('stores one global daily session and community presence separately', async () => {
    await testDb.db.insert(wordleGlobalDays).values({
      word_date: '2026-11-01',
      word: 'termo',
      word_length: 5,
      created_at: 1,
    });
    await testDb.db.insert(wordleGlobalSessions).values({
      id: 'global-session',
      user_id: 'global-player',
      word_date: '2026-11-01',
      created_at: 1,
    });
    await testDb.db.insert(wordleCommunityParticipation).values({
      guild_id: 'community-a',
      user_id: 'global-player',
      first_seen_at: 1,
      last_seen_at: 1,
    });
    await testDb.db.insert(wordleCommunityDailyPresence).values({
      guild_id: 'community-a',
      user_id: 'global-player',
      word_date: '2026-11-01',
      first_seen_at: 1,
    });
    await testDb.db.insert(wordleCommunityDailyPresence).values({
      guild_id: 'community-b',
      user_id: 'global-player',
      word_date: '2026-11-01',
      first_seen_at: 2,
    });

    const sessions = await testDb.db.select().from(wordleGlobalSessions);
    const presences = await testDb.db
      .select()
      .from(wordleCommunityDailyPresence);
    expect(sessions).toHaveLength(1);
    expect(presences).toHaveLength(2);
  });

  test('limits the global showcase to three distinct achievement ids', async () => {
    await testDb.db.insert(wordleShowcase).values([
      {
        user_id: 'showcase-player',
        slot: 1,
        achievement_id: 'a',
        updated_at: 1,
      },
      {
        user_id: 'showcase-player',
        slot: 2,
        achievement_id: 'b',
        updated_at: 1,
      },
      {
        user_id: 'showcase-player',
        slot: 3,
        achievement_id: 'c',
        updated_at: 1,
      },
    ]);
    await expect(
      testDb.db
        .insert(wordleShowcase)
        .values({
          user_id: 'too-many',
          slot: 4,
          achievement_id: 'd',
          updated_at: 1,
        })
        .execute(),
    ).rejects.toThrow();
    await expect(
      testDb.db
        .insert(wordleShowcase)
        .values([
          { user_id: 'duplicate', slot: 1, achievement_id: 'a', updated_at: 1 },
          { user_id: 'duplicate', slot: 2, achievement_id: 'a', updated_at: 1 },
        ])
        .execute(),
    ).rejects.toThrow();
  });

  test('allows only one recorded first solver per guild and day', async () => {
    await testDb.db.execute(sql`
      INSERT INTO wordle_days (guild_id, word_date, is_legacy, created_at)
      VALUES ('first-guild', '2026-10-24', true, 1)
      ON CONFLICT DO NOTHING
    `);
    await testDb.db.execute(sql`
      INSERT INTO wordle_sessions (id, user_id, guild_id, word_date, solved, attempts, created_at, first_solver)
      VALUES ('first-solver-a', 'first-a', 'first-guild', '2026-10-24', true, 1, 1, true)
    `);
    await expect(
      testDb.db
        .execute(
          sql`
      INSERT INTO wordle_sessions (id, user_id, guild_id, word_date, solved, attempts, created_at, first_solver)
      VALUES ('first-solver-b', 'first-b', 'first-guild', '2026-10-24', true, 1, 1, true)
    `,
        )
        .execute(),
    ).rejects.toThrow();
    await testDb.db.execute(sql`
      INSERT INTO wordle_sessions (id, user_id, guild_id, word_date, solved, attempts, created_at, first_solver)
      VALUES ('later-solver', 'later', 'first-guild', '2026-10-24', true, 2, 1, false)
    `);
  });
  test('keeps legacy solve timestamps unknown and lets one be recorded later', async () => {
    await testDb.db.execute(sql`
      INSERT INTO wordle_days (guild_id, word_date, is_legacy, created_at)
      VALUES ('g1', '2026-10-23', true, 1)
      ON CONFLICT DO NOTHING
    `);
    await testDb.db.execute(sql`
      INSERT INTO wordle_sessions (id, user_id, guild_id, word_date, solved, attempts, created_at)
      VALUES ('legacy-wordle', 'u1', 'g1', '2026-10-23', true, 3, 1)
    `);
    const [legacy] = await testDb.db.execute<{ solved_at: number | null }>(sql`
      SELECT solved_at FROM wordle_sessions WHERE id = 'legacy-wordle'
    `);
    expect(legacy?.solved_at).toBeNull();
    await testDb.db.execute(sql`
      UPDATE wordle_sessions SET solved_at = 1792800000 WHERE id = 'legacy-wordle'
    `);
    const [updated] = await testDb.db.execute<{ solved_at: number }>(sql`
      SELECT solved_at::float8 AS solved_at FROM wordle_sessions WHERE id = 'legacy-wordle'
    `);
    expect(updated?.solved_at).toBe(1792800000);
  });
  test('re-running is a no-op', async () => {
    await runMigrations(testDb.db);
    const rows = await testDb.db.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`,
    );
    expect(rows[0]!.n).toBeGreaterThanOrEqual(2);
  });

  test('stamps updated_at on update', async () => {
    await testDb.db.insert(users).values({ id: 'u1' });
    await testDb.db
      .update(users)
      .set({ lastfm_username: 'x' })
      .where(sql`${users.id} = 'u1'`);
    const [row] = await testDb.db.select().from(users);
    const nowSeconds = Math.floor(Date.now() / 1000);
    expect(row!.updated_at).toBeGreaterThan(nowSeconds - 60);
    expect(row!.updated_at).toBeLessThanOrEqual(nowSeconds + 1);
  });

  test('wordle user config starts with every option disabled', async () => {
    await testDb.db.insert(wordleUserConfig).values({ user_id: 'fresh' });
    const [row] = await testDb.db
      .select()
      .from(wordleUserConfig)
      .where(sql`${wordleUserConfig.user_id} = 'fresh'`);
    expect(row).toMatchObject({
      invert_action_keys: false,
      enable_sounds: false,
      enable_space_key: false,
      enable_arrow_keys: false,
    });
  });

  test('wordle arrow keys require the space key', async () => {
    const insert = testDb.db.insert(wordleUserConfig).values({
      user_id: 'u1',
      enable_arrow_keys: true,
      enable_space_key: false,
    });
    await expect(insert.execute()).rejects.toThrow();
  });
});
