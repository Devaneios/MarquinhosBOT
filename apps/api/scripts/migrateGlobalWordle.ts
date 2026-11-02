import { closeDefaultDb, db } from '@marquinhos/database/client';
import { migrateGlobalWordle } from '../src/services/wordle/WordleGlobalMigrationService';

async function main() {
  const args = Bun.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') {
    console.log('Usage: bun scripts/migrateGlobalWordle.ts [--apply]');
    return;
  }
  if (args.length > 1 || (args.length === 1 && args[0] !== '--apply')) {
    throw new Error('Expected no arguments or --apply');
  }
  try {
    const result = await migrateGlobalWordle(db, {
      dryRun: args[0] !== '--apply',
    });
    console.log(JSON.stringify(result));
  } finally {
    await closeDefaultDb();
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : '';
    console.error(
      message.startsWith('Global migration ') || message.startsWith('Expected ')
        ? message
        : 'Global Wordle migration failed',
    );
    process.exitCode = 1;
  });
}
