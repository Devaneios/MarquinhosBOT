import type { Tx } from '@marquinhos/database/client';
import { sql } from 'drizzle-orm';

export async function lockWordleAchievements(
  tx: Tx,
  userId: string,
): Promise<void> {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['wordle-global-achievements', userId])}, 0))`,
  );
}
