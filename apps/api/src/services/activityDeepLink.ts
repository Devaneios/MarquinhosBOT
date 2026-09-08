import { db } from 'database/sqlite';

const DEEP_LINK_TTL_MS = 60_000;

export function recordDeepLink(
  userId: string,
  guildId: string,
  game: string,
  createdAt: number = Date.now(),
): void {
  db.query(
    `INSERT OR REPLACE INTO activity_deep_links (user_id, guild_id, game, created_at)
     VALUES ($user_id, $guild_id, $game, $created_at)`,
  ).run({
    $user_id: userId,
    $guild_id: guildId,
    $game: game,
    $created_at: createdAt,
  });
}

// Atomically claims (and deletes) the pending intent for this user/guild, so
// a repeat call — e.g. a re-render or reconnect — never re-navigates the
// player. Intents older than the TTL are treated as if they don't exist,
// so a session nobody ever consumed doesn't keep matching forever.
export function claimDeepLink(userId: string, guildId: string): string | null {
  const cutoff = Date.now() - DEEP_LINK_TTL_MS;
  const row = db
    .query<
      { game: string },
      { $user_id: string; $guild_id: string; $cutoff: number }
    >(
      `DELETE FROM activity_deep_links
       WHERE user_id = $user_id AND guild_id = $guild_id AND created_at > $cutoff
       RETURNING game`,
    )
    .get({ $user_id: userId, $guild_id: guildId, $cutoff: cutoff });
  return row?.game ?? null;
}
