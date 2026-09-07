import { Database } from 'bun:sqlite';
import { beforeEach, describe, expect, it } from 'bun:test';
import { RateLimitService } from 'services/aiChat/RateLimitService';

function setupDb(): Database {
  const db = new Database(':memory:');
  db.run(`
    CREATE TABLE ai_chat_config (
      key TEXT PRIMARY KEY,
      value INTEGER NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE ai_chat_usage (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      usage_date TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, guild_id, usage_date)
    )
  `);
  db.run(`
    CREATE TABLE ai_chat_global_usage (
      guild_id TEXT NOT NULL,
      usage_date TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (guild_id, usage_date)
    )
  `);
  db.run(
    "INSERT INTO ai_chat_config (key, value) VALUES ('user_daily_limit', 2), ('global_daily_limit', 3)",
  );
  return db;
}

describe('RateLimitService.checkAndIncrement', () => {
  let db: Database;
  let service: RateLimitService;

  beforeEach(() => {
    db = setupDb();
    service = new RateLimitService(db);
  });

  it('allows the first call for a user', () => {
    expect(service.checkAndIncrement('user1', 'guild1', '2026-07-22')).toBe(
      true,
    );
  });

  it('allows calls up to the per-user daily limit', () => {
    service.checkAndIncrement('user1', 'guild1', '2026-07-22');
    expect(service.checkAndIncrement('user1', 'guild1', '2026-07-22')).toBe(
      true,
    );
  });

  it('blocks calls once the per-user daily limit is exceeded', () => {
    service.checkAndIncrement('user1', 'guild1', '2026-07-22');
    service.checkAndIncrement('user1', 'guild1', '2026-07-22');
    expect(service.checkAndIncrement('user1', 'guild1', '2026-07-22')).toBe(
      false,
    );
  });

  it('resets the per-user count on a new day', () => {
    service.checkAndIncrement('user1', 'guild1', '2026-07-22');
    service.checkAndIncrement('user1', 'guild1', '2026-07-22');
    expect(service.checkAndIncrement('user1', 'guild1', '2026-07-23')).toBe(
      true,
    );
  });

  it('does not enforce the per-user limit across different users', () => {
    service.checkAndIncrement('user1', 'guild1', '2026-07-22');
    service.checkAndIncrement('user1', 'guild1', '2026-07-22');
    expect(service.checkAndIncrement('user2', 'guild1', '2026-07-22')).toBe(
      true,
    );
  });

  it('blocks all users once the global daily limit is exceeded', () => {
    service.checkAndIncrement('user1', 'guild1', '2026-07-22');
    service.checkAndIncrement('user2', 'guild1', '2026-07-22');
    service.checkAndIncrement('user3', 'guild1', '2026-07-22');
    expect(service.checkAndIncrement('user4', 'guild1', '2026-07-22')).toBe(
      false,
    );
  });

  it("does not consume a user's budget when the call is blocked by the global limit", () => {
    // Exhaust the global limit (3) using three different users, each within their own per-user limit (2)
    expect(service.checkAndIncrement('u1', 'guild1', '2026-07-22')).toBe(true);
    expect(service.checkAndIncrement('u2', 'guild1', '2026-07-22')).toBe(true);
    expect(service.checkAndIncrement('u3', 'guild1', '2026-07-22')).toBe(true);

    // u4 is under their own per-user limit but the global cap is now hit → blocked
    expect(service.checkAndIncrement('u4', 'guild1', '2026-07-22')).toBe(false);

    // u4's per-user counter must NOT have been consumed by that blocked call:
    // there should be no ai_chat_usage row for u4 (rolled back)
    const row = db
      .query(
        'SELECT count FROM ai_chat_usage WHERE user_id = ? AND guild_id = ? AND usage_date = ?',
      )
      .get('u4', 'guild1', '2026-07-22');
    expect(row).toBeNull();
  });

  it('falls back to defaults when ai_chat_config has no rows', () => {
    const emptyDb = new Database(':memory:');
    emptyDb.run(
      'CREATE TABLE ai_chat_config (key TEXT PRIMARY KEY, value INTEGER NOT NULL)',
    );
    emptyDb.run(`
      CREATE TABLE ai_chat_usage (
        user_id TEXT NOT NULL, guild_id TEXT NOT NULL, usage_date TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, guild_id, usage_date)
      )
    `);
    emptyDb.run(`
      CREATE TABLE ai_chat_global_usage (
        guild_id TEXT NOT NULL, usage_date TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (guild_id, usage_date)
      )
    `);
    const fallbackService = new RateLimitService(emptyDb);
    expect(
      fallbackService.checkAndIncrement('user1', 'guild1', '2026-07-22'),
    ).toBe(true);
  });
});

describe('RateLimitService.seedDefaults', () => {
  it('inserts default config rows when the table is empty', () => {
    const db = new Database(':memory:');
    db.run(
      'CREATE TABLE ai_chat_config (key TEXT PRIMARY KEY, value INTEGER NOT NULL)',
    );
    const service = new RateLimitService(db);
    service.seedDefaults();
    const rows = db
      .query('SELECT * FROM ai_chat_config ORDER BY key')
      .all() as {
      key: string;
      value: number;
    }[];
    expect(rows).toEqual([
      { key: 'global_daily_limit', value: 2000 },
      { key: 'user_daily_limit', value: 100 },
    ]);
  });

  it('does not overwrite existing config rows', () => {
    const db = new Database(':memory:');
    db.run(
      'CREATE TABLE ai_chat_config (key TEXT PRIMARY KEY, value INTEGER NOT NULL)',
    );
    db.run(
      "INSERT INTO ai_chat_config (key, value) VALUES ('user_daily_limit', 5)",
    );
    const service = new RateLimitService(db);
    service.seedDefaults();
    const row = db
      .query('SELECT value FROM ai_chat_config WHERE key = ?')
      .get('user_daily_limit') as { value: number };
    expect(row.value).toBe(5);
  });

  it('backfills missing keys even when the table already has other config keys', () => {
    const db = new Database(':memory:');
    db.run(
      'CREATE TABLE ai_chat_config (key TEXT PRIMARY KEY, value INTEGER NOT NULL)',
    );
    db.run(
      "INSERT INTO ai_chat_config (key, value) VALUES ('agent_daily_limit', 50)",
    );
    const service = new RateLimitService(db);
    service.seedDefaults();
    const rows = db
      .query('SELECT * FROM ai_chat_config ORDER BY key')
      .all() as {
      key: string;
      value: number;
    }[];
    expect(rows).toEqual([
      { key: 'agent_daily_limit', value: 50 },
      { key: 'global_daily_limit', value: 2000 },
      { key: 'user_daily_limit', value: 100 },
    ]);
  });
});
