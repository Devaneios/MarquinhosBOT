import { NestFactory } from '@nestjs/core';
import type { Db } from '@marquinhos/database/client';
import { runMigrations } from '@marquinhos/database/migrate';
import { DB } from '../src/database/database.tokens';
import { WordleAchievementService } from '../src/modules/wordle/services/wordle-achievement.service';
import { ScriptsModule } from '../src/scripts/scripts.module';

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
  const app = await NestFactory.createApplicationContext(ScriptsModule, {
    logger: false,
  });
  try {
    await runMigrations(app.get<Db>(DB));
    console.log(
      JSON.stringify(
        await app
          .get(WordleAchievementService)
          .backfill({ guildId, batchSize }),
      ),
    );
  } finally {
    await app.close();
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Backfill failed');
    process.exitCode = 1;
  });
}
