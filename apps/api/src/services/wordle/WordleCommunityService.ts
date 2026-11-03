import type { Db } from '@marquinhos/database/client';
import {
  wordleCommunityDailyPresence,
  wordleCommunityParticipation,
} from '@marquinhos/database/schema';
import { sql } from 'drizzle-orm';
import { logger } from 'utils/logger';
import { WordleAlbumService } from './WordleAlbumService';

/** Records a player opening or playing in a community, without creating a session. */
export async function recordWordlePresence(
  database: Db,
  userId: string,
  guildId: string,
  date: string,
  timestamp: number,
): Promise<void> {
  await database.transaction(async (tx) => {
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
    await tx
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
      });
  });
  try {
    await new WordleAlbumService(database).pages(guildId);
  } catch {
    logger.warn('wordle.album.presence_projection_failed');
  }
}
