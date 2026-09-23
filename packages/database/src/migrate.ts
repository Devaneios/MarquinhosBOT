import type { Database } from 'bun:sqlite';
import * as fs from 'fs';
import * as path from 'path';
import { db as defaultDb } from './sqlite';

interface Migration {
  version: string;
  up(database: Database): void;
}

const UPDATED_AT_TABLES = [
  'users',
  'user_levels',
  'user_stats',
  'user_achievements',
];

const codeMigrations: Migration[] = [
  {
    version: '007_repair_updated_at',
    up(database) {
      for (const table of UPDATED_AT_TABLES) {
        const columns = database
          .query<{ name: string }, [string]>(
            'SELECT name FROM pragma_table_info(?)',
          )
          .all(table);
        if (columns.length === 0) continue;
        if (columns.some((column) => column.name === 'updated_at')) continue;
        database.run(`ALTER TABLE ${table} ADD COLUMN updated_at INTEGER`);
        database.run(
          `UPDATE ${table} SET updated_at = cast(strftime('%s','now') as int)`,
        );
      }
    },
  },
];

export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let blockDepth = 0;
  let i = 0;

  const flush = () => {
    const statement = current.trim();
    if (statement) statements.push(statement);
    current = '';
  };

  while (i < sql.length) {
    const ch = sql[i]!;

    if (ch === '-' && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i);
      i = end === -1 ? sql.length : end;
      continue;
    }

    if (ch === "'") {
      let end = i + 1;
      while (end < sql.length) {
        if (sql[end] === "'" && sql[end + 1] === "'") end += 2;
        else if (sql[end] === "'") break;
        else end += 1;
      }
      current += sql.slice(i, end + 1);
      i = end + 1;
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      let end = i;
      while (end < sql.length && /\w/.test(sql[end]!)) end += 1;
      const word = sql.slice(i, end).toUpperCase();
      if (word === 'BEGIN' && /^\s*CREATE\s+TRIGGER\b/i.test(current)) {
        blockDepth += 1;
      } else if (word === 'CASE' && blockDepth > 0) {
        blockDepth += 1;
      } else if (word === 'END' && blockDepth > 0) {
        blockDepth -= 1;
      }
      current += sql.slice(i, end);
      i = end;
      continue;
    }

    if (ch === ';' && blockDepth === 0) {
      flush();
      i += 1;
      continue;
    }

    current += ch;
    i += 1;
  }

  flush();
  return statements;
}

function sqlMigrations(migrationsDir: string): Migration[] {
  if (!fs.existsSync(migrationsDir)) return [];
  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .map((file) => ({
      version: file,
      up(database: Database) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        for (const statement of splitSqlStatements(sql)) {
          database.run(statement);
        }
      },
    }));
}

export function runMigrations(
  database: Database = defaultDb,
  migrationsDir: string = path.join(import.meta.dir, 'migrations'),
) {
  database.run(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at INTEGER)',
  );

  const migrations = [...sqlMigrations(migrationsDir), ...codeMigrations].sort(
    (a, b) => a.version.localeCompare(b.version),
  );

  for (const migration of migrations) {
    const isApplied = database
      .query('SELECT 1 FROM schema_migrations WHERE version = ?')
      .get(migration.version);
    if (isApplied) continue;

    console.log(`[db] Applying migration: ${migration.version}`);
    database.transaction(() => {
      migration.up(database);
      database
        .query(
          'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
        )
        .run(migration.version, Date.now());
    })();
    console.log(`[db] Applied ${migration.version}`);
  }
}
