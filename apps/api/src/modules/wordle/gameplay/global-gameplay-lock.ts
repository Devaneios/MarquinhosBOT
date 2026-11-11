import type { Tx } from '@marquinhos/database/client';
import { sql } from 'drizzle-orm';

export async function lockGlobalWordlePlayer(
  tx: Tx,
  userId: string,
  date: string,
): Promise<void> {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['wordle-global-gameplay', userId, date])}, 0))`,
  );
}
