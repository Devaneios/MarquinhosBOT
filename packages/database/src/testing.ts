import { createHash, randomUUID } from 'crypto';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import postgres from 'postgres';
import { createDb, type Db } from './client';
import { MIGRATIONS_FOLDER, runMigrations } from './migrate';

// CREATE DATABASE ... TEMPLATE refuses while anyone else is connected to the
// template, so all template work is serialised on this advisory lock.
const TEMPLATE_LOCK_KEY = 815_224_001;

export interface TestDb {
  db: Db;
  url: string;
  /** Empties every table and restarts sequences; much cheaper than a new database. */
  reset(): Promise<void>;
  drop(): Promise<void>;
}

function adminUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL is required (e.g. postgres://postgres@127.0.0.1:5432/postgres)',
    );
  }
  return url;
}

function withDatabase(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

/** The template is keyed by migration contents so a schema change rebuilds it. */
function templateName(): string {
  const hash = createHash('sha256');
  for (const file of fs.readdirSync(MIGRATIONS_FOLDER).sort()) {
    if (file.endsWith('.sql')) {
      hash.update(fs.readFileSync(path.join(MIGRATIONS_FOLDER, file)));
    }
  }
  return `marquinhos_tpl_${hash.digest('hex').slice(0, 12)}`;
}

async function ensureTemplate(
  admin: postgres.Sql,
  template: string,
): Promise<void> {
  const [existing] = await admin`
    SELECT 1 FROM pg_database WHERE datname = ${template}`;
  if (existing) return;

  await admin.unsafe(`CREATE DATABASE "${template}"`);
  const handle = createDb(withDatabase(adminUrl(), template), 1);
  try {
    await runMigrations(handle.db);
  } finally {
    await handle.close();
  }
}

/** Creates an isolated, fully migrated database for one test scope. */
export async function createTestDb(): Promise<TestDb> {
  const admin = postgres(adminUrl(), { max: 1, onnotice: () => undefined });
  const template = templateName();
  const name = `marquinhos_test_${randomUUID().replaceAll('-', '')}`;
  try {
    await admin`SELECT pg_advisory_lock(${TEMPLATE_LOCK_KEY})`;
    try {
      await ensureTemplate(admin, template);
      await admin.unsafe(`CREATE DATABASE "${name}" TEMPLATE "${template}"`);
    } finally {
      await admin`SELECT pg_advisory_unlock(${TEMPLATE_LOCK_KEY})`;
    }
  } finally {
    await admin.end();
  }

  const url = withDatabase(adminUrl(), name);
  const handle = createDb(url, 4);
  return {
    db: handle.db,
    url,
    async reset() {
      const tables = await handle.db.execute<{ name: string }>(
        sql`SELECT quote_ident(tablename) AS name FROM pg_tables WHERE schemaname = 'public'`,
      );
      if (tables.length === 0) return;
      await handle.db.execute(
        sql.raw(
          `TRUNCATE ${tables.map((t) => t.name).join(', ')} RESTART IDENTITY CASCADE`,
        ),
      );
    },
    async drop() {
      await handle.close();
      const dropper = postgres(adminUrl(), {
        max: 1,
        onnotice: () => undefined,
      });
      try {
        await dropper.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      } finally {
        await dropper.end();
      }
    },
  };
}
