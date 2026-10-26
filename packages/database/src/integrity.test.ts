import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import { sql } from 'drizzle-orm';
import { auditData } from './audit';
import { createTestDb, type TestDb } from './testing';

let testDb: TestDb;

beforeAll(async () => {
  testDb = await createTestDb();
});

beforeEach(async () => {
  await testDb.reset();
});

afterAll(async () => {
  await testDb.drop();
});

describe('data integrity constraints', () => {
  test('cascades parent deletion to AI events and items', async () => {
    await testDb.db.execute(sql`
      INSERT INTO ai_traces (trace_id, user_id, guild_id, channel_id, content, created_at)
      VALUES ('trace', 'u', 'g', 'c', 'prompt', 1)
    `);
    await testDb.db.execute(sql`
      INSERT INTO ai_trace_events (trace_id, seq, type, created_at)
      VALUES ('trace', 1, 'llm', 1)
    `);
    await testDb.db.execute(sql`
      INSERT INTO ai_thread_sessions (thread_id, guild_id, channel_id, owner_user_id, mode, created_at, last_used_at)
      VALUES ('thread', 'g', 'c', 'u', 'ask', 1, 1)
    `);
    await testDb.db.execute(sql`
      INSERT INTO ai_thread_items (thread_id, seq, item_json, created_at)
      VALUES ('thread', 1, '{}', 1)
    `);
    await testDb.db.execute(sql`
      INSERT INTO ai_research_jobs (job_id, idempotency_key, thread_id, user_id, guild_id, channel_id, query, created_at)
      VALUES ('job', 'once', 'thread', 'u', 'g', 'c', 'query', 1)
    `);
    await testDb.db.execute(sql`
      INSERT INTO ai_research_events (job_id, seq, stage, message, created_at)
      VALUES ('job', 1, 'search', 'started', 1)
    `);

    await testDb.db.execute(
      sql`DELETE FROM ai_traces WHERE trace_id = 'trace'`,
    );
    await testDb.db.execute(
      sql`DELETE FROM ai_thread_sessions WHERE thread_id = 'thread'`,
    );
    await testDb.db.execute(
      sql`DELETE FROM ai_research_jobs WHERE job_id = 'job'`,
    );

    const [children] = await testDb.db.execute<{ total: number }>(sql`
      SELECT ((SELECT count(*) FROM ai_trace_events)
           + (SELECT count(*) FROM ai_thread_items)
           + (SELECT count(*) FROM ai_research_events))::int AS total
    `);
    expect(children?.total).toBe(0);
  });

  test('rejects duplicate AI sequence numbers', async () => {
    await testDb.db.execute(sql`
      INSERT INTO ai_traces (trace_id, user_id, guild_id, channel_id, content, created_at)
      VALUES ('trace', 'u', 'g', 'c', 'prompt', 1)
    `);
    await testDb.db.execute(sql`
      INSERT INTO ai_trace_events (trace_id, seq, type, created_at)
      VALUES ('trace', 1, 'llm', 1)
    `);
    await expect(
      testDb.db
        .execute(
          sql`
      INSERT INTO ai_trace_events (trace_id, seq, type, created_at)
      VALUES ('trace', 1, 'tool', 2)
    `,
        )
        .execute(),
    ).rejects.toThrow();
  });

  test('requires tournament participants to be registered and the winner to be a participant', async () => {
    await testDb.db.execute(sql`
      INSERT INTO pong_tournaments (id, guild_id, name, format, pool, status, config_json, created_by, created_at)
      VALUES ('cup', 'g', 'Cup', 'round-robin', 'classic-1v1', 'active', '{}', 'host', 1)
    `);
    await testDb.db.execute(sql`
      INSERT INTO pong_tournament_entries (tournament_id, user_id, seed, rating)
      VALUES ('cup', 'a', 1, 1500), ('cup', 'b', 2, 1400)
    `);
    await expect(
      testDb.db
        .execute(
          sql`
      INSERT INTO pong_tournament_matches (id, tournament_id, bracket, round, position, player_a, player_b, winner_id, status)
      VALUES ('bad-player', 'cup', 'main', 1, 1, 'a', 'outsider', 'a', 'complete')
    `,
        )
        .execute(),
    ).rejects.toThrow();
    await expect(
      testDb.db
        .execute(
          sql`
      INSERT INTO pong_tournament_matches (id, tournament_id, bracket, round, position, player_a, player_b, winner_id, status)
      VALUES ('bad-winner', 'cup', 'main', 1, 2, 'a', 'b', 'outsider', 'complete')
    `,
        )
        .execute(),
    ).rejects.toThrow();
  });

  test('creates a legacy day row for a session inserted without one', async () => {
    await testDb.db.execute(sql`
      INSERT INTO wordle_sessions (id, user_id, guild_id, word_date, created_at)
      VALUES ('s', 'u', 'g', '2026-10-25', 1)
    `);
    const [day] = await testDb.db.execute<{
      is_legacy: boolean;
      word: string | null;
    }>(sql`
      SELECT is_legacy, word FROM wordle_days
      WHERE guild_id = 'g' AND word_date = '2026-10-25'
    `);
    expect(day).toEqual({ is_legacy: true, word: null });
  });
});

// The expand release must keep the previous release working: after migrating,
// redeploying the previous image is the rollback. These statements are shaped
// like what that image runs.
describe('previous release compatibility', () => {
  test('wordle_daily writes surface in wordle_days, and sessions fill their day', async () => {
    await testDb.db.execute(sql`
      INSERT INTO wordle_daily (guild_id, word, word_date, created_at)
      VALUES ('g', 'termo', '2026-10-25', 1)
    `);
    await testDb.db.execute(sql`
      INSERT INTO wordle_sessions (id, user_id, guild_id, word_date, created_at, word_length)
      VALUES ('s1', 'u', 'g', '2026-10-25', 1, 5)
    `);
    await testDb.db.execute(sql`
      INSERT INTO wordle_sessions (id, user_id, guild_id, word_date, created_at, word_length)
      VALUES ('s0', 'u', 'g', '2026-10-24', 1, 5)
    `);
    await testDb.db.execute(sql`
      UPDATE wordle_daily SET players_count = 2, winners_count = 1, total_attempts = 4
      WHERE guild_id = 'g'
    `);

    const days = await testDb.db.execute<{
      word_date: string;
      word: string | null;
      word_length: number | null;
      is_legacy: boolean;
      players_count: number;
    }>(sql`
      SELECT word_date, word, word_length, is_legacy, players_count
      FROM wordle_days WHERE guild_id = 'g' ORDER BY word_date
    `);
    expect([...days]).toEqual([
      {
        word_date: '2026-10-24',
        word: null,
        word_length: 5,
        is_legacy: true,
        players_count: 0,
      },
      {
        word_date: '2026-10-25',
        word: 'termo',
        word_length: 5,
        is_legacy: false,
        players_count: 2,
      },
    ]);
  });

  test('wordle_days writes stay readable through wordle_daily, newest day wins', async () => {
    await testDb.db.execute(sql`
      INSERT INTO wordle_days (guild_id, word_date, word, word_length, created_at)
      VALUES ('g', '2026-10-25', 'termo', 5, 1)
    `);
    await testDb.db.execute(sql`
      INSERT INTO wordle_sessions (id, user_id, guild_id, word_date, created_at)
      VALUES ('s', 'u', 'g', '2026-10-25', 1)
    `);
    await testDb.db.execute(sql`
      UPDATE wordle_days SET players_count = 3 WHERE guild_id = 'g'
    `);
    // A late write to an older day must not replace today's word.
    await testDb.db.execute(sql`
      INSERT INTO wordle_days (guild_id, word_date, word, word_length, created_at)
      VALUES ('g', '2026-10-24', 'carro', 5, 1)
    `);

    const [daily] = await testDb.db.execute<{
      word: string;
      word_date: string;
      players_count: number;
    }>(
      sql`SELECT word, word_date, players_count FROM wordle_daily WHERE guild_id = 'g'`,
    );
    expect(daily).toEqual({
      word: 'termo',
      word_date: '2026-10-25',
      players_count: 3,
    });
    const [session] = await testDb.db.execute<{ word_length: number }>(
      sql`SELECT word_length FROM wordle_sessions WHERE id = 's'`,
    );
    expect(session?.word_length).toBe(5);
  });

  test('game results work with and without the legacy guild_id', async () => {
    await testDb.db.execute(sql`
      INSERT INTO game_results (id, guild_id, game_type, played_at)
      VALUES ('r', 'g', 'pong', 1)
    `);
    await testDb.db.execute(sql`
      INSERT INTO user_game_results (game_result_id, user_id, guild_id, position, xp_awarded)
      VALUES ('r', 'old', 'g', 1, 10)
    `);
    await testDb.db.execute(sql`
      INSERT INTO user_game_results (game_result_id, user_id, position, xp_awarded)
      VALUES ('r', 'new', 2, 5)
    `);
    const rows = await testDb.db.execute<{ user_id: string; guild_id: string }>(
      sql`SELECT user_id, guild_id FROM user_game_results ORDER BY user_id`,
    );
    expect([...rows]).toEqual([
      { user_id: 'new', guild_id: 'g' },
      { user_id: 'old', guild_id: 'g' },
    ]);
  });

  test('explicit child-then-parent AI deletes still work', async () => {
    await testDb.db.execute(sql`
      INSERT INTO ai_traces (trace_id, user_id, guild_id, channel_id, content, created_at)
      VALUES ('trace', 'u', 'g', 'c', 'prompt', 1)
    `);
    await testDb.db.execute(sql`
      INSERT INTO ai_trace_events (trace_id, seq, type, created_at)
      VALUES ('trace', 1, 'llm', 1)
    `);
    await testDb.db.execute(
      sql`DELETE FROM ai_trace_events WHERE trace_id = 'trace'`,
    );
    await testDb.db.execute(
      sql`DELETE FROM ai_traces WHERE trace_id = 'trace'`,
    );
  });
});

describe('data audit', () => {
  test('passes on a clean migrated database in both modes', async () => {
    expect(await auditData(false, testDb.db)).toEqual([]);
    expect(await auditData(true, testDb.db)).toEqual([]);
  });

  test('keeps working after the contract release drops the legacy objects', async () => {
    // Its own database: reset() empties tables but cannot restore dropped objects.
    const contracted = await createTestDb();
    try {
      await contracted.db.execute(sql`
        DROP TRIGGER wordle_daily_to_days ON wordle_daily;
        DROP TRIGGER wordle_days_to_daily ON wordle_days;
        DROP TRIGGER wordle_sessions_fill_day ON wordle_sessions;
        DROP TRIGGER user_game_results_fill_guild ON user_game_results;
        DROP TABLE wordle_daily;
        ALTER TABLE wordle_sessions DROP COLUMN word_length;
        DROP INDEX idx_user_game_results_user;
        ALTER TABLE user_game_results DROP COLUMN guild_id;
      `);
      expect(await auditData(false, contracted.db)).toEqual([]);
      expect(await auditData(true, contracted.db)).toEqual([]);
    } finally {
      await contracted.drop();
    }
  });
});
