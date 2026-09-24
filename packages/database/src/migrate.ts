import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as path from 'path';
import { db as defaultDb, type Db } from './client';

export const MIGRATIONS_FOLDER = path.join(import.meta.dir, '..', 'drizzle');

export async function runMigrations(database: Db = defaultDb): Promise<void> {
  await migrate(database, { migrationsFolder: MIGRATIONS_FOLDER });
}
