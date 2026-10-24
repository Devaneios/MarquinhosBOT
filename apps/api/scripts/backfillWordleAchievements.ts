import { closeDefaultDb } from '@marquinhos/database/client';
import { runMigrations } from '@marquinhos/database/migrate';
import { WordleAchievementService } from '../src/services/wordle/WordleAchievementService';

async function main() {
  const args = Bun.argv.slice(2);
  let guildId: string | undefined;
  let batchSize = 100;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--help') {
      console.log(
        'Usage: bun scripts/backfillWordleAchievements.ts [--guild-id ID] [--batch-size 1..1000]',
      );
      return;
    }
    if (arg === '--guild-id') guildId = args[++index];
    else if (arg === '--batch-size') batchSize = Number(args[++index]);
    else throw new Error(`Unknown argument: ${arg}`);
    if (arg === '--guild-id' && !guildId)
      throw new Error('--guild-id requires a value');
  }
  try {
    await runMigrations();
    console.log(
      JSON.stringify(
        await new WordleAchievementService().backfill({ guildId, batchSize }),
      ),
    );
  } finally {
    await closeDefaultDb();
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Backfill failed');
    process.exitCode = 1;
  });
}
