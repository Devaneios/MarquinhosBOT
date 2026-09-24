/**
 * One-off copy of the legacy SQLite database into Postgres.
 *
 *   DATABASE_URL=postgres://… bun packages/database/src/etl/importSqlite.ts /app/data/marquinhos.db
 *
 * Runs the Postgres migrations, refuses to touch a target that already holds
 * user data (the defaults the API seeds on boot are replaced), copies every
 * table in one transaction and fails (rolling everything back) unless each
 * table's row count matches the source.
 */
import { Database } from 'bun:sqlite';
import { is, sql } from 'drizzle-orm';
import { getTableConfig, PgTable, type PgColumn } from 'drizzle-orm/pg-core';
import { closeDefaultDb, db as defaultDb, type Db, type Tx } from '../client';
import { runMigrations } from '../migrate';
import * as schema from '../schema';

// Postgres caps one statement at 65535 bind parameters.
const MAX_PARAMS_PER_INSERT = 60_000;

// The API seeds these defaults on its first boot, before the import can run.
// The SQLite rows are authoritative (operators may have tuned them), so these
// tables are emptied and refilled instead of blocking the import.
const SEEDED_TABLES = new Set(['achievements', 'ai_chat_config', 'xp_config']);

// Postgres-only columns that stand in for SQLite's implicit rowid.
const ROWID_COLUMNS: Record<string, string> = { wordlist_review: 'seq' };

export interface TableReport {
  table: string;
  source: number;
  target: number;
}

type Row = Record<string, unknown>;

function schemaTables(): PgTable[] {
  return (Object.values(schema) as unknown[]).filter(
    (value): value is PgTable => is(value, PgTable),
  );
}

/** Parents before children, so foreign keys hold at every insert. */
function inDependencyOrder(tables: PgTable[]): PgTable[] {
  const byName = new Map(tables.map((t) => [getTableConfig(t).name, t]));
  const ordered: PgTable[] = [];
  const visited = new Set<string>();
  const visit = (table: PgTable) => {
    const { name, foreignKeys } = getTableConfig(table);
    if (visited.has(name)) return;
    visited.add(name);
    for (const fk of foreignKeys) {
      const parent = getTableConfig(fk.reference().foreignTable).name;
      const parentTable = byName.get(parent);
      if (parentTable) visit(parentTable);
    }
    ordered.push(table);
  };
  for (const table of tables) visit(table);
  return ordered;
}

function sqliteColumns(sqlite: Database, table: string): Set<string> {
  const rows = sqlite
    .query<{ name: string }, [string]>('SELECT name FROM pragma_table_info(?)')
    .all(table);
  return new Set(rows.map((row) => row.name));
}

/** SQLite stored booleans as 0/1; Postgres wants real booleans. */
function convert(column: PgColumn, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (column.dataType === 'boolean') return value === 1 || value === true;
  return value;
}

async function assertTargetEmpty(db: Db, tables: PgTable[]): Promise<void> {
  for (const table of tables) {
    const { name } = getTableConfig(table);
    if (SEEDED_TABLES.has(name)) continue;
    const [row] = await db.execute<{ present: boolean }>(
      sql`SELECT EXISTS (SELECT 1 FROM ${sql.identifier(name)}) AS present`,
    );
    if (row?.present) {
      throw new Error(
        `Target table ${name} already has rows; refusing to import over live data`,
      );
    }
  }
}

async function copyTable(
  sqlite: Database,
  tx: Tx,
  table: PgTable,
): Promise<TableReport> {
  const { name, columns } = getTableConfig(table);
  const available = sqliteColumns(sqlite, name);
  // A table the SQLite file never had (older deploys) simply stays empty.
  if (available.size === 0) return { table: name, source: 0, target: 0 };

  const rowidColumn = ROWID_COLUMNS[name];
  const copied = columns.filter(
    (column) => available.has(column.name) || column.name === rowidColumn,
  );
  const selectList = copied
    .map((column) =>
      column.name === rowidColumn
        ? `rowid AS "${column.name}"`
        : `"${column.name}"`,
    )
    .join(', ');
  const sourceRows = sqlite
    .query<Row, []>(`SELECT ${selectList} FROM "${name}" ORDER BY rowid`)
    .all();

  const batchSize = Math.max(
    1,
    Math.floor(MAX_PARAMS_PER_INSERT / copied.length),
  );
  for (let i = 0; i < sourceRows.length; i += batchSize) {
    const batch = sourceRows.slice(i, i + batchSize).map((row) => {
      const converted: Row = {};
      for (const column of copied) {
        converted[column.name] = convert(column, row[column.name]);
      }
      return converted;
    });
    await tx.insert(table).values(batch);
  }

  const [counted] = await tx.execute<{ n: number }>(
    sql`SELECT COUNT(*)::int AS n FROM ${sql.identifier(name)}`,
  );
  return { table: name, source: sourceRows.length, target: counted?.n ?? 0 };
}

/** Explicit ids were copied, so each serial sequence must resume after them. */
async function resetSequences(tx: Tx, tables: PgTable[]): Promise<void> {
  for (const table of tables) {
    const { name, columns } = getTableConfig(table);
    for (const column of columns) {
      if (column.columnType !== 'PgBigSerial53') continue;
      await tx.execute(sql`
        SELECT setval(
          pg_get_serial_sequence(${name}, ${column.name}),
          COALESCE(MAX(${sql.identifier(column.name)}), 1),
          MAX(${sql.identifier(column.name)}) IS NOT NULL
        ) FROM ${sql.identifier(name)}`);
    }
  }
}

/**
 * Writes a consistent, self-contained copy of the SQLite database (WAL
 * folded in) next to it, and returns its path. This copy is the rollback
 * point if the cutover goes wrong.
 */
export function backupSqlite(sqlitePath: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = sqlitePath.replace(
    /(\.db)?$/,
    `.pre-postgres-${stamp}.db`,
  );
  const sqlite = new Database(sqlitePath, { readonly: true });
  try {
    sqlite.query('VACUUM INTO ?').run(backupPath);
  } finally {
    sqlite.close();
  }
  return backupPath;
}

export async function importSqlite(
  sqlitePath: string,
  db: Db,
): Promise<TableReport[]> {
  const sqlite = new Database(sqlitePath, { readonly: true });
  try {
    await runMigrations(db);
    const tables = inDependencyOrder(schemaTables());
    await assertTargetEmpty(db, tables);

    return await db.transaction(async (tx) => {
      // DELETE, not TRUNCATE: Postgres refuses to truncate a table other
      // tables reference, even when those are empty (checked above).
      for (const name of SEEDED_TABLES) {
        await tx.execute(sql`DELETE FROM ${sql.identifier(name)}`);
      }
      const reports: TableReport[] = [];
      for (const table of tables) {
        reports.push(await copyTable(sqlite, tx, table));
      }
      await resetSequences(tx, tables);

      const mismatched = reports.filter((r) => r.source !== r.target);
      if (mismatched.length > 0) {
        throw new Error(
          `Row counts differ: ${mismatched
            .map((r) => `${r.table} ${r.source}→${r.target}`)
            .join(', ')}`,
        );
      }
      return reports;
    });
  } finally {
    sqlite.close();
  }
}

if (import.meta.main) {
  const sqlitePath = process.argv[2];
  if (!sqlitePath) {
    console.error('usage: bun importSqlite.ts <path-to-marquinhos.db>');
    process.exit(2);
  }
  try {
    const backupPath = backupSqlite(sqlitePath);
    console.log(`SQLite backup written to ${backupPath}`);
    // Import from the snapshot so the copied data is exactly what was saved.
    const reports = await importSqlite(backupPath, defaultDb);
    console.table(reports);
    console.log('Import complete.');
  } catch (error) {
    console.error('Import failed; Postgres was left unchanged.', error);
    process.exitCode = 1;
  } finally {
    await closeDefaultDb();
  }
}
