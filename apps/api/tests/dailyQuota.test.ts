import { Database } from 'bun:sqlite';
import { beforeEach, describe, expect, it } from 'bun:test';
import {
  AGENT_DAILY_QUOTA,
  DailyQuotaService,
  RESEARCH_DAILY_QUOTA,
} from 'services/aiChat/DailyQuotaService';

function setupDb(limit = 2): Database {
  const db = new Database(':memory:');
  db.run(`
    CREATE TABLE ai_chat_config (
      key TEXT PRIMARY KEY,
      value INTEGER NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE ai_agent_usage (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      usage_date TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, guild_id, usage_date)
    )
  `);
  db.run(
    `INSERT INTO ai_chat_config (key, value) VALUES ('agent_daily_limit', ${limit})`,
  );
  return db;
}

describe('DailyQuotaService.checkAndIncrement', () => {
  let db: Database;
  let service: DailyQuotaService;

  beforeEach(() => {
    db = setupDb(2);
    service = new DailyQuotaService(AGENT_DAILY_QUOTA, db);
  });

  it('allows the first call for a user', () => {
    expect(service.checkAndIncrement('user1', 'guild1', '2026-07-22')).toBe(
      true,
    );
  });

  it('allows calls up to the daily limit', () => {
    service.checkAndIncrement('user1', 'guild1', '2026-07-22');
    expect(service.checkAndIncrement('user1', 'guild1', '2026-07-22')).toBe(
      true,
    );
  });

  it('blocks calls once the daily limit is exceeded', () => {
    service.checkAndIncrement('user1', 'guild1', '2026-07-22');
    service.checkAndIncrement('user1', 'guild1', '2026-07-22');
    expect(service.checkAndIncrement('user1', 'guild1', '2026-07-22')).toBe(
      false,
    );
  });

  it('resets the count on a new day', () => {
    service.checkAndIncrement('user1', 'guild1', '2026-07-22');
    service.checkAndIncrement('user1', 'guild1', '2026-07-22');
    expect(service.checkAndIncrement('user1', 'guild1', '2026-07-23')).toBe(
      true,
    );
  });

  it('does not enforce the limit across different users', () => {
    service.checkAndIncrement('user1', 'guild1', '2026-07-22');
    service.checkAndIncrement('user1', 'guild1', '2026-07-22');
    expect(service.checkAndIncrement('user2', 'guild1', '2026-07-22')).toBe(
      true,
    );
  });

  it('falls back to the default limit when ai_chat_config has no agent_daily_limit row', () => {
    const emptyDb = new Database(':memory:');
    emptyDb.run(
      'CREATE TABLE ai_chat_config (key TEXT PRIMARY KEY, value INTEGER NOT NULL)',
    );
    emptyDb.run(`
      CREATE TABLE ai_agent_usage (
        user_id TEXT NOT NULL, guild_id TEXT NOT NULL, usage_date TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, guild_id, usage_date)
      )
    `);
    const fallbackService = new DailyQuotaService(AGENT_DAILY_QUOTA, emptyDb);
    for (let i = 0; i < 50; i++) {
      expect(
        fallbackService.checkAndIncrement('user1', 'guild1', '2026-07-22'),
      ).toBe(true);
    }
    expect(
      fallbackService.checkAndIncrement('user1', 'guild1', '2026-07-22'),
    ).toBe(false);
  });
});

describe('DailyQuotaService.seedDefaults', () => {
  it('inserts the agent_daily_limit default when the table is empty', () => {
    const db = new Database(':memory:');
    db.run(
      'CREATE TABLE ai_chat_config (key TEXT PRIMARY KEY, value INTEGER NOT NULL)',
    );
    const service = new DailyQuotaService(AGENT_DAILY_QUOTA, db);
    service.seedDefaults();
    const row = db
      .query('SELECT * FROM ai_chat_config WHERE key = ?')
      .get('agent_daily_limit') as { key: string; value: number };
    expect(row).toEqual({ key: 'agent_daily_limit', value: 50 });
  });

  it('does not overwrite an existing agent_daily_limit row', () => {
    const db = new Database(':memory:');
    db.run(
      'CREATE TABLE ai_chat_config (key TEXT PRIMARY KEY, value INTEGER NOT NULL)',
    );
    db.run(
      "INSERT INTO ai_chat_config (key, value) VALUES ('agent_daily_limit', 20)",
    );
    const service = new DailyQuotaService(AGENT_DAILY_QUOTA, db);
    service.seedDefaults();
    const row = db
      .query('SELECT value FROM ai_chat_config WHERE key = ?')
      .get('agent_daily_limit') as { value: number };
    expect(row.value).toBe(20);
  });

  it('backfills agent_daily_limit even when the table already has other config keys', () => {
    const db = new Database(':memory:');
    db.run(
      'CREATE TABLE ai_chat_config (key TEXT PRIMARY KEY, value INTEGER NOT NULL)',
    );
    db.run(
      "INSERT INTO ai_chat_config (key, value) VALUES ('user_daily_limit', 10), ('global_daily_limit', 200)",
    );
    const service = new DailyQuotaService(AGENT_DAILY_QUOTA, db);
    service.seedDefaults();
    const rows = db
      .query('SELECT * FROM ai_chat_config ORDER BY key')
      .all() as { key: string; value: number }[];
    expect(rows).toEqual([
      { key: 'agent_daily_limit', value: 50 },
      { key: 'global_daily_limit', value: 200 },
      { key: 'user_daily_limit', value: 10 },
    ]);
  });
});

describe('DailyQuotaService with the research quota', () => {
  it('enforces the research_daily_limit stored in ai_chat_config', () => {
    const db = new Database(':memory:');
    db.run(
      'CREATE TABLE ai_chat_config (key TEXT PRIMARY KEY, value INTEGER NOT NULL)',
    );
    db.run(`
      CREATE TABLE ai_research_usage (
        user_id TEXT NOT NULL, guild_id TEXT NOT NULL, usage_date TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, guild_id, usage_date)
      )
    `);
    db.run(
      "INSERT INTO ai_chat_config (key, value) VALUES ('research_daily_limit', 1)",
    );
    const service = new DailyQuotaService(RESEARCH_DAILY_QUOTA, db);

    expect(service.checkAndIncrement('user1', 'guild1', '2026-07-22')).toBe(
      true,
    );
    expect(service.checkAndIncrement('user1', 'guild1', '2026-07-22')).toBe(
      false,
    );
  });
});
