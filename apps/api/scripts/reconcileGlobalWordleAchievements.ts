import { closeDefaultDb, db } from '@marquinhos/database/client';
import { WordleGlobalAchievementService } from '../src/services/wordle/WordleGlobalAchievementService';

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
  try {
    const result = await new WordleGlobalAchievementService(db).checkAndAward(
      args[1],
      args[3],
    );
    console.log(
      JSON.stringify({ achievementsAwarded: result.unlockedIds.length }),
    );
  } finally {
    await closeDefaultDb();
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
