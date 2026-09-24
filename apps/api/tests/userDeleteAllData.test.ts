import { runMigrations } from '@marquinhos/database/migrate';
import { db } from '@marquinhos/database/sqlite';
import { beforeAll, describe, expect, it } from 'bun:test';
import { UserService } from 'services/user';

beforeAll(() => runMigrations());

const USER = 'delete-me';
const OTHER = 'keep-me';

function count(sql: string, ...params: string[]): number {
  return db.query<{ n: number }, string[]>(sql).get(...params)!.n;
}

function seed(userId: string) {
  const now = Date.now();
  db.prepare('INSERT INTO users (id) VALUES (?)').run(userId);
  db.prepare('INSERT INTO user_levels (user_id, guild_id) VALUES (?, ?)').run(
    userId,
    'g',
  );
  db.prepare(
    'INSERT INTO wordle_sessions (id, user_id, guild_id, word_date, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(`ws-${userId}`, userId, 'g', '2026-09-24', now);
  db.prepare(
    'INSERT INTO ai_traces (trace_id, user_id, guild_id, channel_id, content, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(`trace-${userId}`, userId, 'g', 'c', 'what I asked', now);
  db.prepare(
    'INSERT INTO ai_trace_events (trace_id, seq, type, created_at) VALUES (?, 1, ?, ?)',
  ).run(`trace-${userId}`, 'llm', now);
  db.prepare(
    "INSERT INTO ai_thread_sessions (thread_id, guild_id, channel_id, owner_user_id, mode, created_at, last_used_at) VALUES (?, 'g', 'c', ?, 'ask', ?, ?)",
  ).run(`thread-${userId}`, userId, now, now);
  db.prepare(
    'INSERT INTO ai_thread_items (thread_id, seq, item_json, created_at) VALUES (?, 1, ?, ?)',
  ).run(`thread-${userId}`, '{}', now);
}

describe('UserService.deleteAllData', () => {
  it("deletes the user's stored data and leaves other users' alone", async () => {
    seed(USER);
    seed(OTHER);

    await new UserService().deleteAllData(USER);

    for (const [table, column] of [
      ['users', 'id'],
      ['user_levels', 'user_id'],
      ['wordle_sessions', 'user_id'],
      ['ai_traces', 'user_id'],
      ['ai_thread_sessions', 'owner_user_id'],
    ] as const) {
      expect({
        table,
        mine: count(
          `SELECT COUNT(*) AS n FROM ${table} WHERE ${column} = ?`,
          USER,
        ),
        theirs: count(
          `SELECT COUNT(*) AS n FROM ${table} WHERE ${column} = ?`,
          OTHER,
        ),
      }).toEqual({ table, mine: 0, theirs: 1 });
    }
    expect(
      count(
        'SELECT COUNT(*) AS n FROM ai_trace_events WHERE trace_id = ?',
        `trace-${USER}`,
      ),
    ).toBe(0);
    expect(
      count(
        'SELECT COUNT(*) AS n FROM ai_thread_items WHERE thread_id = ?',
        `thread-${USER}`,
      ),
    ).toBe(0);
    expect(
      count(
        'SELECT COUNT(*) AS n FROM ai_thread_items WHERE thread_id = ?',
        `thread-${OTHER}`,
      ),
    ).toBe(1);
  });
});
