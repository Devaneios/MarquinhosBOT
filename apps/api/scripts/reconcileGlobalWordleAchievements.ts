import { NestFactory } from '@nestjs/core';
import { ScriptsModule } from '../src/scripts/scripts.module';
import { WordleGlobalAchievementService } from '../src/modules/wordle/services/wordle-global-achievement.service';

async function main() {
  const args = Bun.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') {
    console.log(
      'Usage: bun scripts/reconcileGlobalWordleAchievements.ts --user-id ID --guild-id ID',
    );
    return;
  }
  if (
    args.length !== 4 ||
    args[0] !== '--user-id' ||
    !args[1] ||
    args[2] !== '--guild-id' ||
    !args[3]
  ) {
    throw new Error('Expected --user-id ID --guild-id ID');
  }
  const app = await NestFactory.createApplicationContext(ScriptsModule, {
    logger: false,
  });
  try {
    const result = await app
      .get(WordleGlobalAchievementService)
      .checkAndAward(args[1], args[3]);
    console.log(
      JSON.stringify({ achievementsAwarded: result.unlockedIds.length }),
    );
  } finally {
    await app.close();
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(
      error instanceof Error
        ? error.message
        : 'Global achievement reconciliation failed',
    );
    process.exitCode = 1;
  });
}
