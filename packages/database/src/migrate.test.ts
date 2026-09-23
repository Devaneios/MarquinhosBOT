import { Database } from 'bun:sqlite';
import { describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runMigrations, splitSqlStatements } from './migrate';
import { db } from './sqlite';

function columns(database: Database, table: string): string[] {
  return database
    .query<{ name: string }, [string]>('SELECT name FROM pragma_table_info(?)')
    .all(table)
    .map((column) => column.name);
}

function appliedVersions(database: Database): string[] {
  return database
    .query<{ version: string }, []>(
      'SELECT version FROM schema_migrations ORDER BY version',
    )
    .all()
    .map((row) => row.version);
}

function tempMigrationsDir(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migrations-'));
  for (const [name, sql] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), sql);
  }
  return dir;
}

describe('splitSqlStatements', () => {
  it('keeps trigger bodies, CASE blocks and quoted semicolons intact', () => {
    const sql = `
      -- a comment; with a semicolon
      CREATE TABLE t (a TEXT);
      INSERT INTO t VALUES ('x;y');
      CREATE TRIGGER trg AFTER UPDATE ON t
      BEGIN
        UPDATE t SET a = CASE WHEN NEW.a = 'z' THEN 'w' ELSE NEW.a END;
      END;
      SELECT 1
    `;

    expect(splitSqlStatements(sql)).toEqual([
      'CREATE TABLE t (a TEXT)',
      "INSERT INTO t VALUES ('x;y')",
      "CREATE TRIGGER trg AFTER UPDATE ON t\n      BEGIN\n        UPDATE t SET a = CASE WHEN NEW.a = 'z' THEN 'w' ELSE NEW.a END;\n      END",
      'SELECT 1',
    ]);
  });
});

describe('runMigrations', () => {
  it('applies every shipped migration on top of the base schema', () => {
    runMigrations(db);

    expect(appliedVersions(db)).toEqual([
      '001_add_updated_at.sql',
      '002_raise_ai_chat_limits.sql',
      '003_pong_competitive.sql',
      '004_pong_tournament_sources.sql',
      '005_create_wordle_user_config.sql',
      '006_add_wordle_keyboard_config.sql',
      '007_repair_updated_at',
    ]);
    expect(columns(db, 'user_stats')).toContain('updated_at');
  });

  it('repairs a database where 001 was recorded but its columns were never added', () => {
    const broken = new Database(':memory:');
    broken.run('CREATE TABLE user_stats (user_id TEXT, total_commands INT)');
    broken.run("INSERT INTO user_stats VALUES ('u1', 0)");
    broken.run(`CREATE TRIGGER trg_user_stats_updated_at
      AFTER UPDATE ON user_stats FOR EACH ROW
      BEGIN
        UPDATE user_stats SET updated_at = 1 WHERE user_id = NEW.user_id;
      END`);
    broken.run(
      'CREATE TABLE schema_migrations (version TEXT PRIMARY KEY, applied_at INTEGER)',
    );
    broken.run(
      "INSERT INTO schema_migrations VALUES ('001_add_updated_at.sql', 0)",
    );

    runMigrations(broken, tempMigrationsDir({}));
    broken.run(
      "UPDATE user_stats SET total_commands = total_commands + 1 WHERE user_id = 'u1'",
    );

    expect(columns(broken, 'user_stats')).toContain('updated_at');
    expect(
      broken
        .query<{ total_commands: number }, []>(
          'SELECT total_commands FROM user_stats',
        )
        .get(),
    ).toEqual({ total_commands: 1 });
  });

  it('throws on a failing statement and does not record the migration', () => {
    const database = new Database(':memory:');
    database.run('CREATE TABLE t (a INT)');
    database.run('INSERT INTO t VALUES (1)');
    const dir = tempMigrationsDir({
      '001_bad.sql':
        "CREATE TABLE other (b INT);\nALTER TABLE t ADD COLUMN c INT DEFAULT (strftime('%s','now'));",
    });

    expect(() => runMigrations(database, dir)).toThrow();
    expect(appliedVersions(database)).toEqual([]);
    expect(columns(database, 'other')).toEqual([]);
  });
});
