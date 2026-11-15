import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as fs from 'fs';
import * as path from 'path';
import postgres from 'postgres';
import { createDb, db as defaultDb, type Db } from './client';

function resolveMigrationsFolder(): string {
  const candidates = [
    path.join(import.meta.dir, '..', 'drizzle'),
    path.resolve(
      import.meta.dir,
      '..',
      '..',
      'packages',
      'database',
      'drizzle',
    ),
    path.resolve(
      import.meta.dir,
      '..',
      '..',
      '..',
      'packages',
      'database',
      'drizzle',
    ),
    path.resolve(process.cwd(), 'packages', 'database', 'drizzle'),
    path.resolve(process.cwd(), '..', '..', 'packages', 'database', 'drizzle'),
  ];
  return (
    candidates.find((dir) =>
      fs.existsSync(path.join(dir, 'meta', '_journal.json')),
    ) ?? candidates[0]!
  );
}

export const MIGRATIONS_FOLDER = resolveMigrationsFolder();

const MIGRATION_ADVISORY_LOCK_KEY = 815_224_002;

export async function runMigrations(database: Db = defaultDb): Promise<void> {
  if (database === defaultDb && process.env.DATABASE_URL) {
    const lockClient = postgres(process.env.DATABASE_URL, {
      max: 1,
      connect_timeout: 10,
      onnotice: () => undefined,
    });
    const migrationHandle = createDb(process.env.DATABASE_URL, 1);
    try {
      await lockClient`SELECT pg_advisory_lock(${MIGRATION_ADVISORY_LOCK_KEY})`;
      try {
        await migrate(migrationHandle.db, {
          migrationsFolder: MIGRATIONS_FOLDER,
        });
      } finally {
        await lockClient`SELECT pg_advisory_unlock(${MIGRATION_ADVISORY_LOCK_KEY})`;
      }
    } finally {
      await migrationHandle.close();
      await lockClient.end({ timeout: 5 });
    }
    return;
  }

  await migrate(database, { migrationsFolder: MIGRATIONS_FOLDER });
}
