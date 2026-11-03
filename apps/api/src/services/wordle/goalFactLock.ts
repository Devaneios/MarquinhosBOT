import type { DbExecutor } from '@marquinhos/database/client';
import { sql } from 'drizzle-orm';

/** Writers take a shared lock; closing a goal takes the exclusive lock. */
export async function lockGoalFactsForWrite(tx: DbExecutor): Promise<void> {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock_shared(hashtextextended('wordle-goal-facts', 0))`,
  );
}

export async function lockGoalFactsForClosing(tx: DbExecutor): Promise<void> {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended('wordle-goal-facts', 0))`,
  );
}
