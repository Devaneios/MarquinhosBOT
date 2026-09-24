import { sql } from 'drizzle-orm';
import { bigint, check, integer, pgTable, text } from 'drizzle-orm/pg-core';

// Marks that the one-off SQLite import ran, so later boots skip it. Drop this
// table together with the import code once the SQLite volume is retired.
export const legacySqliteImport = pgTable(
  'legacy_sqlite_import',
  {
    id: integer('id').primaryKey().default(1),
    imported_at: bigint('imported_at', { mode: 'number' }).notNull(),
    snapshot_path: text('snapshot_path').notNull(),
  },
  (t) => [check('legacy_sqlite_import_single_row', sql`${t.id} = 1`)],
);
