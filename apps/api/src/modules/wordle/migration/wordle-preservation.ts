import type { DbExecutor } from '@marquinhos/database/client';
import { sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';

const SOURCE_TABLES = [
  'users',
  'wordle_config',
  'wordle_daily',
  'wordle_sessions',
  'wordle_streaks',
  'wordle_used_words',
  'wordlist_review',
  'wordle_user_config',
  'wordle_guild_config',
  'achievements',
  'user_achievements',
  'evolutive_achievements',
  'user_levels',
] as const;

type SourceTable = (typeof SOURCE_TABLES)[number];

export interface WordlePreservationTable {
  rowCount: number;
  tableHash: string;
  keyedHashes: Array<{ key: string; hash: string }>;
}

export interface WordlePreservationReport {
  version: 1;
  inspectedAt: string;
  schema: Record<string, string[]>;
  tables: Partial<Record<SourceTable, WordlePreservationTable>>;
  users: number;
  unknownAnswerDays: number;
  multipleGuildPlayerDates: number;
  invalidDataIssues: Record<string, number>;
}

export interface WordlePreservationVerification {
  ok: boolean;
  mismatches: Record<string, number>;
}

const digest = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function tableExists(db: DbExecutor, table: string): Promise<boolean> {
  const result = await db.execute<{ exists: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${table}
    ) AS exists
  `);
  return Boolean(result[0]?.exists);
}

async function columnsFor(db: DbExecutor, table: string): Promise<string[]> {
  const result = await db.execute<{ column_name: string }>(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}
    ORDER BY ordinal_position
  `);
  return result.map((row) => row.column_name);
}

async function keysFor(db: DbExecutor, table: string): Promise<string[]> {
  const result = await db.execute<{ column_name: string }>(sql`
    SELECT kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public' AND tc.table_name = ${table}
      AND tc.constraint_type = 'PRIMARY KEY'
    ORDER BY kcu.ordinal_position
  `);
  return result.map((row) => row.column_name);
}

/** Read-only keyed inventory of the known Wordle progress sources. */
export async function auditWordlePreservation(
  database: DbExecutor,
): Promise<WordlePreservationReport> {
  const tables: WordlePreservationReport['tables'] = {};
  const schema: Record<string, string[]> = {};
  let users = 0;
  const invalidDataIssues: Record<string, number> = {};

  for (const table of SOURCE_TABLES) {
    if (!(await tableExists(database, table))) continue;
    const columns = await columnsFor(database, table);
    schema[table] = columns;
    const keys = await keysFor(database, table);
    const order = keys.length ? keys : columns;
    const orderSql = order
      .map((column) => `"${column.replaceAll('"', '""')}"`)
      .join(', ');
    const rows = await database.execute<{ row: Record<string, unknown> }>(
      sql.raw(
        `SELECT to_jsonb(source_row) AS row FROM "${table}" AS source_row ORDER BY ${orderSql}`,
      ),
    );
    const keyedHashes = rows.map(({ row }) => {
      const key = keys.length
        ? keys
            .map((column) => `${column}=${JSON.stringify(row[column])}`)
            .join('&')
        : digest(row);
      return { key, hash: digest(row) };
    });
    tables[table] = {
      rowCount: rows.length,
      tableHash: digest(keyedHashes),
      keyedHashes,
    };
    if (table === 'users') users = rows.length;
    if (table === 'wordle_sessions' && columns.includes('guesses')) {
      for (const { row } of rows) {
        try {
          if (!Array.isArray(JSON.parse(String(row.guesses))))
            invalidDataIssues.invalidGuessPayload =
              (invalidDataIssues.invalidGuessPayload ?? 0) + 1;
        } catch {
          invalidDataIssues.invalidGuessPayload =
            (invalidDataIssues.invalidGuessPayload ?? 0) + 1;
        }
      }
    }
  }

  let unknownAnswerDays = 0;
  if (
    schema.wordle_sessions?.includes('guild_id') &&
    schema.wordle_sessions.includes('word_date')
  ) {
    const answerCol = schema.wordle_daily?.includes('word') ? 'word' : null;
    if (answerCol && schema.wordle_daily?.includes('guild_id')) {
      const result = await database.execute<{ count: number }>(sql`
        SELECT count(DISTINCT (s.guild_id, s.word_date))::int AS count
        FROM wordle_sessions s
        LEFT JOIN wordle_daily d ON d.guild_id = s.guild_id AND d.word_date = s.word_date
        WHERE d.word IS NULL
      `);
      unknownAnswerDays = Number(result[0]?.count ?? 0);
    }
  }

  let multipleGuildPlayerDates = 0;
  if (
    schema.wordle_sessions?.includes('user_id') &&
    schema.wordle_sessions.includes('guild_id') &&
    schema.wordle_sessions.includes('word_date')
  ) {
    const result = await database.execute<{ count: number }>(sql`
      SELECT count(*)::int AS count FROM (
        SELECT user_id, word_date FROM wordle_sessions
        GROUP BY user_id, word_date HAVING count(DISTINCT guild_id) > 1
      ) dates
    `);
    multipleGuildPlayerDates = Number(result[0]?.count ?? 0);
  }

  return {
    version: 1,
    inspectedAt: new Date().toISOString(),
    schema,
    tables,
    users,
    unknownAnswerDays,
    multipleGuildPlayerDates,
    invalidDataIssues,
  };
}

/** Compare only protected source table shape and row contents; additive tables are ignored. */
export async function verifyWordlePreservation(
  database: DbExecutor,
  before: WordlePreservationReport,
): Promise<WordlePreservationVerification> {
  const after = await auditWordlePreservation(database);
  const mismatches: Record<string, number> = {};
  for (const [name, expected] of Object.entries(before.tables) as Array<
    [SourceTable, WordlePreservationTable]
  >) {
    const actual = after.tables[name];
    if (!actual) {
      mismatches[name] = expected.rowCount || 1;
      continue;
    }
    const actualByKey = new Map(
      actual.keyedHashes.map((item) => [item.key, item.hash]),
    );
    let count = Math.max(0, expected.rowCount - actual.rowCount);
    for (const item of expected.keyedHashes)
      if (actualByKey.get(item.key) !== item.hash) count++;
    if (count) mismatches[name] = count;
  }
  return { ok: Object.keys(mismatches).length === 0, mismatches };
}
