import { runMigrations } from '@marquinhos/database/migrate';
import { createTestDb } from '@marquinhos/database/testing';
import { sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const fixture = path.resolve(import.meta.dir, '../fixtures/wordle-v0.0.3');

/** Creates an isolated test DB, then replaces its current schema with the pinned tag schema. */
export async function createWordleV003Db() {
  const testDb = await createTestDb();
  try {
    await testDb.db.execute(
      sql.raw('DROP SCHEMA public CASCADE; CREATE SCHEMA public'),
    );
    const journal = JSON.parse(
      await readFile(path.join(fixture, '_journal.json'), 'utf8'),
    ) as { entries: Array<{ tag: string; when: number }> };
    for (const file of [
      '0000_baseline.sql',
      '0001_updated_at_triggers.sql',
      '0002_legacy_sqlite_import.sql',
    ]) {
      const source = await readFile(path.join(fixture, file), 'utf8');
      for (const statement of source
        .split('--> statement-breakpoint')
        .map((chunk) => chunk.trim())
        .filter(Boolean)) {
        await testDb.db.execute(sql.raw(statement));
      }
    }
    await testDb.db.execute(
      sql.raw(
        'DROP SCHEMA drizzle CASCADE; CREATE SCHEMA drizzle; CREATE TABLE drizzle.__drizzle_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint)',
      ),
    );
    for (const entry of journal.entries) {
      const source = await readFile(
        path.join(fixture, `${entry.tag}.sql`),
        'utf8',
      );
      const hash = createHash('sha256').update(source).digest('hex');
      await testDb.db.execute(
        sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${entry.when})`,
      );
    }
  } catch (error) {
    await testDb.drop();
    throw error;
  }
  return {
    db: testDb.db,
    url: testDb.url,
    upgrade: () => runMigrations(testDb.db),
    drop: testDb.drop,
  };
}
