import type { DbExecutor } from '@marquinhos/database/client';
import { wordleAlbumProjectionQueue } from '@marquinhos/database/schema';
import { sql } from 'drizzle-orm';

export async function enqueueAlbumProjections(
  exec: DbExecutor,
  guildIds: readonly string[],
): Promise<void> {
  const unique = [...new Set(guildIds)].sort();
  if (unique.length === 0) return;
  await exec
    .insert(wordleAlbumProjectionQueue)
    .values(unique.map((guild_id) => ({ guild_id })))
    .onConflictDoUpdate({
      target: wordleAlbumProjectionQueue.guild_id,
      set: { revision: sql`gen_random_uuid()::text`, retry_at: 0 },
    });
}
