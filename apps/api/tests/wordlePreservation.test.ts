import type { Db } from '@marquinhos/database/client';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import {
  auditWordlePreservation,
  verifyWordlePreservation,
} from '../src/modules/wordle/migration/wordle-preservation';
import { createWordleV003Db } from './helpers/wordleV003Db';

let db: Db;
let drop: (() => Promise<void>) | undefined;
let upgrade: (() => Promise<void>) | undefined;

beforeEach(async () => {
  const fixture = await createWordleV003Db();
  db = fixture.db;
  drop = fixture.drop;
  upgrade = fixture.upgrade;
});

afterEach(async () => {
  await drop?.();
  drop = undefined;
  upgrade = undefined;
});

describe('Wordle v0.0.3 preservation inventory', () => {
  test('audits the actual v0.0.3 schema without creating tables', async () => {
    const tablesBefore = await db.execute<{ tablename: string }>(
      sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
    );
    await db.execute(
      sql`INSERT INTO wordle_daily (guild_id, word, word_date, created_at) VALUES ('g1', 'crane', '2024-01-01', 1704067200)`,
    );
    await db.execute(
      sql`INSERT INTO wordle_sessions (id, user_id, guild_id, word_date, guesses, solved, attempts, created_at, word_length) VALUES ('s1', 'u1', 'g1', '2024-01-01', '["crane"]', true, 1, 1704067200, 5)`,
    );
    await db.execute(
      sql`INSERT INTO wordle_sessions (id, user_id, guild_id, word_date, guesses, solved, attempts, created_at, word_length) VALUES ('s2', 'u1', 'g2', '2024-01-01', '["slate"]', false, 1, 1704067200, 5)`,
    );
    const report = await auditWordlePreservation(db);
    const tablesAfter = await db.execute<{ tablename: string }>(
      sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
    );
    expect(tablesAfter).toEqual(tablesBefore);
    expect(report.unknownAnswerDays).toBe(1);
    expect(report.multipleGuildPlayerDates).toBe(1);
    expect(report.tables.wordle_sessions!.rowCount).toBe(2);
    expect(report.tables.wordle_sessions!.keyedHashes).toHaveLength(2);
  });

  test('keeps original legacy rows unchanged when the current schema is applied', async () => {
    await db.execute(
      sql`INSERT INTO wordle_used_words (word, used_at) VALUES ('crane', 1704067200)`,
    );
    const before = await auditWordlePreservation(db);
    await upgrade?.();
    const verification = await verifyWordlePreservation(db, before);
    expect(verification).toEqual({ ok: true, mismatches: {} });
    const destinationTables = await db.execute<{ count: number }>(
      sql`SELECT count(*)::int AS count FROM pg_tables WHERE schemaname = 'public' AND tablename = 'wordle_days'`,
    );
    expect(destinationTables[0]?.count).toBe(1);
  });

  test('detects changes to protected legacy rows', async () => {
    await db.execute(
      sql`INSERT INTO wordle_used_words (word, used_at) VALUES ('crane', 1704067200)`,
    );
    await db.execute(
      sql`INSERT INTO wordle_streaks (user_id, guild_id, current_streak, max_streak, last_solved_date) VALUES ('u1', 'g1', 4, 9, '2024-01-01')`,
    );
    await db.execute(
      sql`INSERT INTO achievements (id, name, description, category, rarity, icon, condition) VALUES ('wordle-old', 'Old', 'Legacy', 'wordle', 'common', 'x', '{}')`,
    );
    await db.execute(
      sql`INSERT INTO user_achievements (user_id, guild_id, achievement_id, unlocked_at) VALUES ('u1', 'g1', 'wordle-old', 1704067200)`,
    );
    await db.execute(
      sql`INSERT INTO wordle_sessions (id, user_id, guild_id, word_date, guesses, solved, attempts, created_at, word_length) VALUES ('s1', 'u1', 'g1', '2024-01-01', '["crane"]', true, 1, 1704067200, 5)`,
    );
    const before = await auditWordlePreservation(db);
    await db.execute(
      sql`UPDATE wordle_used_words SET used_at = 1704067201 WHERE word = 'crane'`,
    );
    await db.execute(
      sql`UPDATE wordle_streaks SET current_streak = 5 WHERE user_id = 'u1'`,
    );
    await db.execute(
      sql`UPDATE user_achievements SET unlocked_at = 1704067201 WHERE user_id = 'u1'`,
    );
    await db.execute(
      sql`UPDATE wordle_sessions SET guesses = '["slate"]' WHERE id = 's1'`,
    );
    const verification = await verifyWordlePreservation(db, before);
    expect(verification.ok).toBe(false);
    expect(verification.mismatches.wordle_used_words).toBeGreaterThan(0);
    expect(verification.mismatches.wordle_streaks).toBeGreaterThan(0);
    expect(verification.mismatches.user_achievements).toBeGreaterThan(0);
    expect(verification.mismatches.wordle_sessions).toBeGreaterThan(0);
  });
});
