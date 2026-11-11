import { closeDefaultDb, db } from '@marquinhos/database/client';
import { runMigrations } from '@marquinhos/database/migrate';
import { ensureDevelopmentWordleReceipt } from '../src/modules/wordle/migration/development-receipt';
import { getRecifeDate } from '../src/modules/wordle/wordle-date';

/**
 * Run before the development server. The API refuses to start without a
 * global Wordle cutover receipt; a development database with no legacy Wordle
 * rows gets its `fresh` receipt here. Production always uses the runbook in
 * docs/wordle-global-migration.md.
 */
async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'prepareDevelopmentWordle is for development databases only',
    );
  }
  try {
    await runMigrations(db);
    await ensureDevelopmentWordleReceipt(db, getRecifeDate());
  } finally {
    await closeDefaultDb();
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(
      error instanceof Error
        ? error.message
        : 'Development Wordle preparation failed',
    );
    process.exitCode = 1;
  });
}
