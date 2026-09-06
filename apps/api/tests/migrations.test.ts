import { Database } from 'bun:sqlite';
import { describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATION = '002_raise_ai_chat_limits.sql';

function migrationSql(): string {
  return fs.readFileSync(
    path.join(process.cwd(), 'src', 'database', 'migrations', MIGRATION),
    'utf8',
  );
}

function dbWithConfig(rows: [string, number][]): Database {
  const db = new Database(':memory:');
  db.run(
    'CREATE TABLE ai_chat_config (key TEXT PRIMARY KEY, value INTEGER NOT NULL)',
  );
  const insert = db.prepare(
    'INSERT INTO ai_chat_config (key, value) VALUES (?, ?)',
  );
  for (const [key, value] of rows) insert.run(key, value);
  return db;
}

function configValues(db: Database): Record<string, number> {
  const rows = db.query('SELECT * FROM ai_chat_config').all() as {
    key: string;
    value: number;
  }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

describe(MIGRATION, () => {
  it('raises limits that are still at the originally seeded defaults', () => {
    const db = dbWithConfig([
      ['user_daily_limit', 10],
      ['global_daily_limit', 200],
      ['agent_daily_limit', 5],
    ]);

    db.run(migrationSql());

    expect(configValues(db)).toEqual({
      user_daily_limit: 100,
      global_daily_limit: 2000,
      agent_daily_limit: 50,
    });
  });

  it('leaves operator-tuned limits untouched', () => {
    const db = dbWithConfig([
      ['user_daily_limit', 25],
      ['global_daily_limit', 500],
      ['agent_daily_limit', 3],
    ]);

    db.run(migrationSql());

    expect(configValues(db)).toEqual({
      user_daily_limit: 25,
      global_daily_limit: 500,
      agent_daily_limit: 3,
    });
  });
});
