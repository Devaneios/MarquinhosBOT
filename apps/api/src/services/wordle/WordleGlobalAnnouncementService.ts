import type { GuessRow } from '@marquinhos/contracts/wordle';
import type { Db } from '@marquinhos/database/client';
import {
  wordleCommunityDailyPresence,
  wordleCommunityWinAnnouncements,
  wordleGlobalSessions,
} from '@marquinhos/database/schema';
import { and, eq, isNull, lte, sql } from 'drizzle-orm';

// A global win belongs to every community the player was present in before
// solving, the same rule that grants first-solve credit, and each of those
// communities claims its announcement separately.
const wonIn = (guildId: string, date: string) =>
  and(
    eq(wordleCommunityDailyPresence.guild_id, guildId),
    eq(wordleCommunityDailyPresence.word_date, date),
    eq(wordleGlobalSessions.solved, true),
    lte(
      wordleCommunityDailyPresence.first_seen_at,
      wordleGlobalSessions.solved_at,
    ),
  );

export class WordleGlobalAnnouncementService {
  constructor(
    private readonly database: Db,
    private readonly now: () => number = Date.now,
  ) {}

  async claim(userId: string, guildId: string, date: string): Promise<boolean> {
    const claimed = await this.database.execute(sql`
      INSERT INTO ${wordleCommunityWinAnnouncements} (guild_id, user_id, word_date, announced_at)
      SELECT ${wordleCommunityDailyPresence.guild_id}, ${wordleCommunityDailyPresence.user_id}, ${wordleCommunityDailyPresence.word_date}, ${Math.floor(this.now() / 1000)}
      FROM ${wordleCommunityDailyPresence}
      INNER JOIN ${wordleGlobalSessions}
        ON ${wordleGlobalSessions.user_id} = ${wordleCommunityDailyPresence.user_id}
        AND ${wordleGlobalSessions.word_date} = ${wordleCommunityDailyPresence.word_date}
      WHERE ${wonIn(guildId, date)} AND ${wordleCommunityDailyPresence.user_id} = ${userId}
      ON CONFLICT DO NOTHING
      RETURNING 1
    `);
    return claimed.length > 0;
  }

  async unannounced(
    guildId: string,
    date: string,
  ): Promise<{ userId: string; guesses: GuessRow[]; attempts: number }[]> {
    const rows = await this.database
      .select({
        userId: wordleGlobalSessions.user_id,
        guesses: wordleGlobalSessions.guesses,
        attempts: wordleGlobalSessions.attempts,
      })
      .from(wordleCommunityDailyPresence)
      .innerJoin(
        wordleGlobalSessions,
        and(
          eq(
            wordleGlobalSessions.user_id,
            wordleCommunityDailyPresence.user_id,
          ),
          eq(
            wordleGlobalSessions.word_date,
            wordleCommunityDailyPresence.word_date,
          ),
        ),
      )
      .leftJoin(
        wordleCommunityWinAnnouncements,
        and(
          eq(
            wordleCommunityWinAnnouncements.guild_id,
            wordleCommunityDailyPresence.guild_id,
          ),
          eq(
            wordleCommunityWinAnnouncements.user_id,
            wordleCommunityDailyPresence.user_id,
          ),
          eq(
            wordleCommunityWinAnnouncements.word_date,
            wordleCommunityDailyPresence.word_date,
          ),
        ),
      )
      .where(
        and(
          wonIn(guildId, date),
          isNull(wordleCommunityWinAnnouncements.guild_id),
        ),
      );
    return rows.map((row) => ({ ...row, guesses: JSON.parse(row.guesses) }));
  }
}
