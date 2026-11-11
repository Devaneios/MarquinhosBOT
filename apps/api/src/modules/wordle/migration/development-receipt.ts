import type { Db } from '@marquinhos/database/client';
import { wordleGlobalCutovers } from '@marquinhos/database/schema';
import { logger } from 'common/logging/logger';
import { prepareGlobalWordleCutover } from './global-cutover';
import { auditWordlePreservation } from './wordle-preservation';

const LEGACY_PROGRESS_TABLES = [
  'wordle_daily',
  'wordle_sessions',
  'wordle_streaks',
] as const;

/**
 * Local development only: a database with no Wordle history gets its `fresh`
 * receipt on first start, so `pnpm run dev` works without the release runbook.
 * A database that holds legacy progress is left for the explicit cutover.
 */
export async function ensureDevelopmentWordleReceipt(
  database: Db,
  today: string,
): Promise<void> {
  const [receipt] = await database
    .select({ id: wordleGlobalCutovers.id })
    .from(wordleGlobalCutovers)
    .limit(1);
  if (receipt) return;
  const before = await auditWordlePreservation(database);
  if (LEGACY_PROGRESS_TABLES.some((table) => before.tables[table]?.rowCount))
    return;
  try {
    await prepareGlobalWordleCutover(database, {
      sourceTag: 'fresh',
      cutoverDate: today,
      before,
    });
    logger.info('wordle.development_receipt_created', { cutoverDate: today });
  } catch (error) {
    logger.warn('wordle.development_receipt_failed', { error });
  }
}
