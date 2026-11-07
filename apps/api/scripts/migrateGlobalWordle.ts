import { NestFactory } from '@nestjs/core';
import type { Db } from '@marquinhos/database/client';
import { runMigrations } from '@marquinhos/database/migrate';
import { DB } from '../src/database/database.tokens';
import { ScriptsModule } from '../src/scripts/scripts.module';
import { migrateGlobalWordle } from '../src/modules/wordle/services/wordle-global-migration.service';

async function main() {
  const args = Bun.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') {
    console.log('Usage: bun scripts/migrateGlobalWordle.ts [--apply]');
    return;
  }
  if (args.length > 1 || (args.length === 1 && args[0] !== '--apply')) {
    throw new Error('Expected no arguments or --apply');
  }
  const app = await NestFactory.createApplicationContext(ScriptsModule, {
    logger: false,
  });
  try {
    const database = app.get<Db>(DB);
    await runMigrations(database);
    const result = await migrateGlobalWordle(database, {
      dryRun: args[0] !== '--apply',
    });
    console.log(JSON.stringify(result));
  } finally {
    await app.close();
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
