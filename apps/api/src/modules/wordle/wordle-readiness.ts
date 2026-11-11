import type { Db } from '@marquinhos/database/client';
import { wordleGlobalCutovers } from '@marquinhos/database/schema';
import { eq } from 'drizzle-orm';

const CUTOVER_ID = 'global-only-v003';

export async function assertGlobalWordleReady(database: Db): Promise<void> {
  const [receipt] = await database
    .select()
    .from(wordleGlobalCutovers)
    .where(eq(wordleGlobalCutovers.id, CUTOVER_ID));
  if (!receipt) {
    throw new Error(
      'Global Wordle is not ready: prepare and verify the global cutover before starting the API.',
    );
  }

  const parsedDate = new Date(`${receipt.cutover_date}T00:00:00.000Z`);
  const validDate =
    /^\d{4}-\d{2}-\d{2}$/.test(receipt.cutover_date) &&
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === receipt.cutover_date;
  if (
    !['v0.0.3', 'fresh'].includes(receipt.source_tag) ||
    !validDate ||
    !/^[a-f\d]{64}$/i.test(receipt.source_digest) ||
    receipt.verified_at <= 0 ||
    receipt.completed_at < receipt.verified_at
  ) {
    throw new Error(
      'Global Wordle is not ready: its cutover receipt is invalid or incomplete.',
    );
  }
}
