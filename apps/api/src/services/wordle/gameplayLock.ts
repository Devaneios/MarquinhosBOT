import type { Tx } from '@marquinhos/database/client';
import { sql } from 'drizzle-orm';

export async function lockWordlePlayer(
  tx: Tx,
  userId: string,
  guildId: string,
): Promise<void> {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['wordle-gameplay', userId, guildId])}, 0))`,
  );
}

export async function lockWordleDay(
  tx: Tx,
  guildId: string,
  date: string,
): Promise<void> {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['wordle-day', guildId, date])}, 0))`,
  );
}
