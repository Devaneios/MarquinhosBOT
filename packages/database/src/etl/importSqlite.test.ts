import { Database } from 'bun:sqlite';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { asc, eq } from 'drizzle-orm';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import {
  aiChatConfig,
  aiTraceEvents,
  pongTournamentEntries,
  users,
  wordleSessions,
  wordlistReview,
} from '../schema';
import { createTestDb, type TestDb } from '../testing';
import { importLegacySqliteOnce, importSqlite } from './importSqlite';

const LEGACY_SCHEMA = path.join(import.meta.dir, 'fixtures/legacySchema.sql');

let testDb: TestDb;
let workDir: string;
let sqlitePath: string;

async function legacyDatabase(): Promise<Database> {
  const sqlite = new Database(sqlitePath, { create: true });
  sqlite.run(await Bun.file(LEGACY_SCHEMA).text());
  return sqlite;
}

beforeEach(async () => {
  testDb = await createTestDb();
  workDir = mkdtempSync(path.join(tmpdir(), 'marquinhos-etl-'));
  sqlitePath = path.join(workDir, 'marquinhos.db');
});

afterEach(async () => {
  await testDb.drop();
  rmSync(workDir, { recursive: true, force: true });
});

describe('importSqlite', () => {
  test('copies every table and converts 0/1 flags to booleans', async () => {
    const sqlite = await legacyDatabase();
    sqlite.run(
      "INSERT INTO users (id, scrobbles_on) VALUES ('on', 1), ('off', 0), ('unset', NULL)",
    );
    sqlite.run(
      `INSERT INTO wordle_sessions (id, user_id, guild_id, word_date, guesses, solved, attempts, created_at, word_length)
       VALUES ('s1', 'on', 'g', '2026-09-01', '[]', 1, 3, 1000, 5)`,
    );
    sqlite.run(
      `INSERT INTO pong_tournaments (id, guild_id, name, format, pool, status, config_json, created_by, created_at)
       VALUES ('t1', 'g', 'Cup', 'round-robin', 'classic-1v1', 'active', '{"swissRounds":1}', 'host', 1)`,
    );
    sqlite.run(
      `INSERT INTO pong_tournament_entries (tournament_id, user_id, seed, rating, score, eliminated)
       VALUES ('t1', 'on', 1, 1512.5, 0.5, 1)`,
    );
    sqlite.close();

    const reports = await importSqlite(sqlitePath, testDb.db);

    expect(reports.find((r) => r.table === 'users')).toEqual({
      table: 'users',
      source: 3,
      target: 3,
    });
    const flags = await testDb.db
      .select({ id: users.id, scrobbles_on: users.scrobbles_on })
      .from(users)
      .orderBy(asc(users.id));
    expect(flags).toEqual([
      { id: 'off', scrobbles_on: false },
      { id: 'on', scrobbles_on: true },
      { id: 'unset', scrobbles_on: null },
    ]);
    const [session] = await testDb.db.select().from(wordleSessions);
    expect(session).toMatchObject({
      solved: true,
      attempts: 3,
      word_length: 5,
    });
    const [entry] = await testDb.db.select().from(pongTournamentEntries);
    expect(entry).toMatchObject({ rating: 1512.5, eliminated: true });
  });

  test('keeps the review queue in SQLite insertion order', async () => {
    const sqlite = await legacyDatabase();
    sqlite.run(
      "INSERT INTO wordlist_review (word, is_banned) VALUES ('zebra', NULL), ('abaco', 1), ('mundo', NULL)",
    );
    sqlite.close();

    await importSqlite(sqlitePath, testDb.db);

    const queue = await testDb.db
      .select({ word: wordlistReview.word })
      .from(wordlistReview)
      .orderBy(asc(wordlistReview.seq));
    expect(queue.map((row) => row.word)).toEqual(['zebra', 'abaco', 'mundo']);
  });

  test('resumes serial ids after the copied rows', async () => {
    const sqlite = await legacyDatabase();
    sqlite.run(
      "INSERT INTO ai_trace_events (id, trace_id, seq, type, created_at) VALUES (41, 't', 1, 'llm', 1)",
    );
    sqlite.close();

    await importSqlite(sqlitePath, testDb.db);

    const [inserted] = await testDb.db
      .insert(aiTraceEvents)
      .values({ trace_id: 't', seq: 2, type: 'llm', created_at: 2 })
      .returning({ id: aiTraceEvents.id });
    expect(inserted!.id).toBe(42);
  });

  test('replaces the defaults the API seeds on its first boot', async () => {
    const sqlite = await legacyDatabase();
    sqlite.run(
      "INSERT INTO ai_chat_config (key, value) VALUES ('user_daily_limit', 7)",
    );
    sqlite.close();
    await testDb.db.insert(aiChatConfig).values([
      { key: 'user_daily_limit', value: 100 },
      { key: 'global_daily_limit', value: 2000 },
    ]);

    await importSqlite(sqlitePath, testDb.db);

    expect(await testDb.db.select().from(aiChatConfig)).toEqual([
      { key: 'user_daily_limit', value: 7 },
    ]);
  });

  test('refuses to import over a database that already has data', async () => {
    const sqlite = await legacyDatabase();
    sqlite.run("INSERT INTO users (id) VALUES ('legacy')");
    sqlite.close();
    await importSqlite(sqlitePath, testDb.db);

    await expect(importSqlite(sqlitePath, testDb.db)).rejects.toThrow(
      /already has rows/,
    );
    const rows = await testDb.db
      .select()
      .from(users)
      .where(eq(users.id, 'legacy'));
    expect(rows).toHaveLength(1);
  });

  test('rolls everything back when a row does not fit the new schema', async () => {
    const sqlite = await legacyDatabase();
    sqlite.run("INSERT INTO users (id) VALUES ('fine')");
    // SQLite never enforced column types; Postgres rejects text in a bigint.
    sqlite.run(
      "INSERT INTO scrobbles_queue (id, track, playback_data, created_at) VALUES ('q', '{}', '{}', 'not-a-number')",
    );
    sqlite.close();

    await expect(importSqlite(sqlitePath, testDb.db)).rejects.toThrow();
    expect(await testDb.db.select().from(users)).toEqual([]);
  });

  test('imports once from a snapshot, then skips on later boots', async () => {
    const sqlite = await legacyDatabase();
    sqlite.run("INSERT INTO users (id) VALUES ('legacy')");
    sqlite.close();

    const first = await importLegacySqliteOnce(sqlitePath, testDb.db);
    const second = await importLegacySqliteOnce(sqlitePath, testDb.db);

    expect(first.status).toBe('imported');
    const snapshotPath = (first as { snapshotPath: string }).snapshotPath;
    expect(existsSync(snapshotPath)).toBe(true);
    expect(second).toMatchObject({ status: 'already-imported', snapshotPath });
    expect(
      readdirSync(workDir).filter((f) => f.includes('pre-postgres')),
    ).toHaveLength(1);
    expect(await testDb.db.select().from(users)).toHaveLength(1);
  });

  test('does nothing when there is no SQLite file', async () => {
    expect(
      await importLegacySqliteOnce(path.join(workDir, 'absent.db'), testDb.db),
    ).toEqual({ status: 'no-source' });
  });

  test('deletes the snapshot when the import fails', async () => {
    const sqlite = await legacyDatabase();
    sqlite.run(
      "INSERT INTO scrobbles_queue (id, track, playback_data, created_at) VALUES ('q', '{}', '{}', 'not-a-number')",
    );
    sqlite.close();

    await expect(
      importLegacySqliteOnce(sqlitePath, testDb.db),
    ).rejects.toThrow();
    expect(
      readdirSync(workDir).filter((f) => f.includes('pre-postgres')),
    ).toEqual([]);
  });
});
