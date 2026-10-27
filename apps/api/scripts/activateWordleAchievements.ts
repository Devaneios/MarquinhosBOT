import { closeDefaultDb } from '@marquinhos/database/client';
import {
  activateWordleAchievements,
  inspectWordleAchievementActivation,
} from '../src/services/wordle/WordleAchievementVersionService';

export async function main(args = Bun.argv.slice(2)) {
  if (args.includes('--help')) {
    console.log(
      'Usage: bun scripts/activateWordleAchievements.ts [--apply]\nDefault inspects only. Stop old API and backfill writers before --apply. Run migrations separately first.',
    );
    return;
  }
  if (args.some((arg) => arg !== '--apply'))
    throw new Error('Only --apply and --help are supported');
  try {
    const inspection = args.includes('--apply')
      ? await activateWordleAchievements()
      : await inspectWordleAchievementActivation();
    console.log(
      JSON.stringify(
        {
          mode: args.includes('--apply') ? 'apply' : 'inspection',
          ...inspection,
        },
        null,
        2,
      ),
    );
  } finally {
    await closeDefaultDb();
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Activation failed');
    process.exitCode = 1;
  });
}
