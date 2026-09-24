import {
  gameIdSchema,
  type GameId,
} from '@marquinhos/contracts/activity/gameId';
import { db } from '@marquinhos/database/client';
import { activityDeepLinks } from '@marquinhos/database/schema';
import { and, eq, gt } from 'drizzle-orm';

const DEEP_LINK_TTL_MS = 60_000;

export async function recordDeepLink(
  userId: string,
  guildId: string,
  game: GameId,
  createdAt: number = Date.now(),
): Promise<void> {
  await db
    .insert(activityDeepLinks)
    .values({ user_id: userId, guild_id: guildId, game, created_at: createdAt })
    .onConflictDoUpdate({
      target: [activityDeepLinks.user_id, activityDeepLinks.guild_id],
      set: { game, created_at: createdAt },
    });
}

// Atomically claims (and deletes) the pending intent for this user/guild, so
// a repeat call — e.g. a re-render or reconnect — never re-navigates the
// player. Intents older than the TTL are treated as if they don't exist,
// so a session nobody ever consumed doesn't keep matching forever.
export async function claimDeepLink(
  userId: string,
  guildId: string,
): Promise<GameId | null> {
  const cutoff = Date.now() - DEEP_LINK_TTL_MS;
  const [row] = await db
    .delete(activityDeepLinks)
    .where(
      and(
        eq(activityDeepLinks.user_id, userId),
        eq(activityDeepLinks.guild_id, guildId),
        gt(activityDeepLinks.created_at, cutoff),
      ),
    )
    .returning({ game: activityDeepLinks.game });
  return gameIdSchema.safeParse(row?.game).data ?? null;
}
