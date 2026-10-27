import { db } from '@marquinhos/database/client';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { sql } from 'drizzle-orm';
import { UserService } from 'services/user';
import { WordleAchievementService } from 'services/wordle/WordleAchievementService';
import { installWordleAchievementCatalog } from './helpers/wordleAchievementCatalog';

const USER = 'delete-me';
const OTHER = 'keep-me';
let restoreCatalog: (() => Promise<void>) | undefined;
beforeAll(async () => {
  restoreCatalog = await installWordleAchievementCatalog();
});

async function count(
  table: string,
  column: string,
  value: string,
): Promise<number> {
  const [row] = await db.execute<{ n: number }>(
    sql`SELECT COUNT(*)::int AS n FROM ${sql.identifier(table)} WHERE ${sql.identifier(column)} = ${value}`,
  );
  return row!.n;
}

async function seed(userId: string) {
  const now = Date.now();
  await db.execute(sql`INSERT INTO users (id) VALUES (${userId})`);
  await db.execute(
    sql`INSERT INTO user_levels (user_id, guild_id) VALUES (${userId}, 'g')`,
  );
  await db.execute(
    sql`INSERT INTO wordle_days (guild_id, word_date, is_legacy, created_at)
        VALUES ('g', '2026-09-24', true, ${now}) ON CONFLICT DO NOTHING`,
  );
  await db.execute(
    sql`INSERT INTO wordle_sessions (id, user_id, guild_id, word_date, created_at)
        VALUES (${`ws-${userId}`}, ${userId}, 'g', '2026-09-24', ${now})`,
  );
  const evidence = {
    patternId: 'tetromino_i',
    color: 'present',
    origin: [0, 0],
    rotation: 0,
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
    ],
    feedback: [['present', 'present', 'present', 'present', 'absent']],
    date: '2026-09-24',
  };
  await db.execute(sql`INSERT INTO wordle_pattern_discoveries
    (user_id, guild_id, version, pattern_id, session_id, discovered_at, evidence)
    VALUES (${userId}, 'g', 2, 'tetromino_i', ${`ws-${userId}`}, ${now}, ${JSON.stringify(evidence)}::jsonb)`);
  await db.execute(
    sql`INSERT INTO ai_traces (trace_id, user_id, guild_id, channel_id, content, created_at)
        VALUES (${`trace-${userId}`}, ${userId}, 'g', 'c', 'what I asked', ${now})`,
  );
  await db.execute(
    sql`INSERT INTO ai_trace_events (trace_id, seq, type, created_at)
        VALUES (${`trace-${userId}`}, 1, 'llm', ${now})`,
  );
  await db.execute(
    sql`INSERT INTO ai_thread_sessions (thread_id, guild_id, channel_id, owner_user_id, mode, created_at, last_used_at)
        VALUES (${`thread-${userId}`}, 'g', 'c', ${userId}, 'ask', ${now}, ${now})`,
  );
  await db.execute(
    sql`INSERT INTO ai_thread_items (thread_id, seq, item_json, created_at)
        VALUES (${`thread-${userId}`}, 1, '{}', ${now})`,
  );
}

// The test database is shared with other files: remove what the test leaves
// behind (the other user's rows and the day row the sessions point at).
afterAll(async () => {
  await new UserService().deleteAllData(OTHER);
  await db.execute(
    sql`DELETE FROM wordle_days WHERE guild_id = 'g' AND word_date = '2026-09-24'`,
  );
  await restoreCatalog?.();
});

describe('UserService.deleteAllData', () => {
  it("deletes the user's stored data and leaves other users' alone", async () => {
    await seed(USER);
    await seed(OTHER);

    await new UserService().deleteAllData(USER);

    for (const [table, column] of [
      ['users', 'id'],
      ['user_levels', 'user_id'],
      ['wordle_sessions', 'user_id'],
      ['wordle_pattern_discoveries', 'user_id'],
      ['ai_traces', 'user_id'],
      ['ai_thread_sessions', 'owner_user_id'],
    ] as const) {
      expect({
        table,
        mine: await count(table, column, USER),
        theirs: await count(table, column, OTHER),
      }).toEqual({ table, mine: 0, theirs: 1 });
    }
    expect(await count('ai_trace_events', 'trace_id', `trace-${USER}`)).toBe(0);
    expect(await count('ai_thread_items', 'thread_id', `thread-${USER}`)).toBe(
      0,
    );
    expect(await count('ai_thread_items', 'thread_id', `thread-${OTHER}`)).toBe(
      1,
    );
    const awards = await db.transaction((tx) =>
      new WordleAchievementService().checkAndAward(USER, 'g', tx),
    );
    expect(awards.unlockedAchievements).toEqual([]);
    expect(await count('user_achievements', 'user_id', USER)).toBe(0);
    expect(await count('user_levels', 'user_id', USER)).toBe(0);
  });
});
