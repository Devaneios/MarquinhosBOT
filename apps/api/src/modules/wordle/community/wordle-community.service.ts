import type { Db } from '@marquinhos/database/client';
import {
  wordleCommunityDailyPresence,
  wordleCommunityParticipation,
} from '@marquinhos/database/schema';
import { logger } from 'common/logging/logger';
import { sql } from 'drizzle-orm';
import { lockGoalFactsForWrite } from './goal-fact-lock';
import { enqueueAlbumProjections } from './wordle-album-projection-queue';
import { WordleAlbumService } from './wordle-album.service';

/** Records a player opening or playing in a community, without creating a session. */
export async function recordWordlePresence(
  database: Db,
  album: WordleAlbumService,
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
    const inserted = presence?.inserted === true;
    if (inserted) await enqueueAlbumProjections(tx, [guildId]);
    return inserted;
  });
  // The album only gains contributions here when this community sees the
  // player for the first time that day.
  if (!firstVisit) return;
  try {
    await album.projectGuild(guildId);
  } catch (error) {
    logger.warn('wordle.album.presence_projection_failed', { error, guildId });
  }
}
