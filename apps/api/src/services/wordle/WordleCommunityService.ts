import type { Db } from '@marquinhos/database/client';
import {
  wordleCommunityDailyPresence,
  wordleCommunityParticipation,
} from '@marquinhos/database/schema';
import { sql } from 'drizzle-orm';
import { logger } from 'utils/logger';
import { WordleAlbumService } from './WordleAlbumService';
import { lockGoalFactsForWrite } from './goalFactLock';

/** Records a player opening or playing in a community, without creating a session. */
export async function recordWordlePresence(
  database: Db,
  userId: string,
  guildId: string,
  date: string,
  timestamp: number,
): Promise<void> {
  const firstVisit = await database.transaction(async (tx) => {
    await lockGoalFactsForWrite(tx);
    await tx
      .insert(wordleCommunityParticipation)
      .values({
        user_id: userId,
        guild_id: guildId,
        first_seen_at: timestamp,
        last_seen_at: timestamp,
      })
      .onConflictDoUpdate({
        target: [
          wordleCommunityParticipation.guild_id,
          wordleCommunityParticipation.user_id,
        ],
        set: {
          first_seen_at: sql`least(${wordleCommunityParticipation.first_seen_at}, ${timestamp})`,
          last_seen_at: sql`greatest(${wordleCommunityParticipation.last_seen_at}, ${timestamp})`,
        },
      });
    const [presence] = await tx
      .insert(wordleCommunityDailyPresence)
      .values({
        user_id: userId,
        guild_id: guildId,
        word_date: date,
        first_seen_at: timestamp,
      })
      .onConflictDoUpdate({
        target: [
          wordleCommunityDailyPresence.guild_id,
          wordleCommunityDailyPresence.user_id,
          wordleCommunityDailyPresence.word_date,
        ],
        set: {
          first_seen_at: sql`least(${wordleCommunityDailyPresence.first_seen_at}, ${timestamp})`,
        },
      })
      .returning({ inserted: sql<boolean>`xmax = 0` });
    return presence?.inserted === true;
  });
  // The album only gains contributions here when this community sees the
  // player for the first time that day.
  if (!firstVisit) return;
  try {
    await new WordleAlbumService(database).pages(guildId);
  } catch (error) {
    logger.warn('wordle.album.presence_projection_failed', { error, guildId });
  }
}
