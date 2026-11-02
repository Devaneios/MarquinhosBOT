import type { Db } from '@marquinhos/database/client';
import {
  wordleCommunityDailyPresence,
  wordleGlobalSessions,
} from '@marquinhos/database/schema';
import { and, asc, desc, eq, gt, lt, or, sql } from 'drizzle-orm';
import { getWordleTimeZone } from './wordleDate';

type Period = 'daily' | 'weekly' | 'monthly' | 'all-time';
export type GlobalDailyEntry = {
  userId: string;
  attempts: number;
  solved: boolean;
};
export type GlobalRankedEntry = {
  userId: string;
  totalDays: number;
  avgScore: number;
};

function shift(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export class WordleGlobalLeaderboardService {
  constructor(private readonly database: Db) {}

  async getLeaderboard(
    guildId: string,
    period: Period,
    today: string,
    limit: number,
    offset = 0,
  ): Promise<GlobalDailyEntry[] | GlobalRankedEntry[]> {
    if (period === 'daily') {
      const rows = await this.database
        .select({
          userId: wordleGlobalSessions.user_id,
          attempts: wordleGlobalSessions.attempts,
          solved: wordleGlobalSessions.solved,
        })
        .from(wordleCommunityDailyPresence)
        .innerJoin(
          wordleGlobalSessions,
          and(
            eq(
              wordleCommunityDailyPresence.user_id,
              wordleGlobalSessions.user_id,
            ),
            eq(
              wordleCommunityDailyPresence.word_date,
              wordleGlobalSessions.word_date,
            ),
          ),
        )
        .where(
          and(
            eq(wordleCommunityDailyPresence.guild_id, guildId),
            eq(wordleCommunityDailyPresence.word_date, today),
            or(
              gt(wordleGlobalSessions.attempts, 0),
              eq(wordleGlobalSessions.solved_from_draft, true),
            ),
          ),
        )
        .orderBy(
          desc(wordleGlobalSessions.solved),
          asc(wordleGlobalSessions.attempts),
          asc(wordleGlobalSessions.created_at),
          asc(wordleGlobalSessions.user_id),
        )
        .limit(limit)
        .offset(offset);
      return rows;
    }
    const from =
      period === 'weekly'
        ? shift(today, -6)
        : period === 'monthly'
          ? `${today.slice(0, 7)}-01`
          : '0001-01-01';
    const timeZone = getWordleTimeZone();
    const rows = await this.database.execute<{
      user_id: string;
      total_days: number;
      avg_score: number;
    }>(sql`
      WITH members AS (
        SELECT user_id, (to_timestamp(first_seen_at) AT TIME ZONE ${timeZone})::date::text AS joined_on
        FROM wordle_community_participation WHERE guild_id = ${guildId}
      ), eligible_days AS (
        SELECT d.word_date, d.word_length FROM wordle_global_days d
        WHERE d.word_date BETWEEN ${from} AND ${today} AND EXISTS (
          SELECT 1 FROM wordle_community_daily_presence p
          JOIN wordle_global_sessions s ON s.user_id = p.user_id AND s.word_date = p.word_date
          WHERE p.guild_id = ${guildId} AND p.word_date = d.word_date
            AND (s.attempts > 0 OR s.solved_from_draft)
        )
      )
      SELECT m.user_id, count(d.word_date)::int AS total_days,
        round(sum(coalesce(s.attempts, d.word_length + 1))::numeric / count(d.word_date), 2)::float8 AS avg_score
      FROM members m JOIN eligible_days d ON d.word_date >= m.joined_on
      LEFT JOIN wordle_global_sessions s ON s.user_id = m.user_id AND s.word_date = d.word_date
      WHERE EXISTS (
        SELECT 1 FROM wordle_global_sessions played
        WHERE played.user_id = m.user_id AND played.word_date BETWEEN greatest(m.joined_on, ${from}) AND ${today}
          AND (played.attempts > 0 OR played.solved_from_draft)
      )
      GROUP BY m.user_id ORDER BY avg_score ASC, m.user_id ASC LIMIT ${limit} OFFSET ${offset}`);
    return rows.map((row) => ({
      userId: row.user_id,
      totalDays: row.total_days,
      avgScore: row.avg_score,
    }));
  }

  async getGroupStreak(guildId: string, today: string): Promise<number> {
    const rows = await this.database
      .selectDistinct({ date: wordleCommunityDailyPresence.word_date })
      .from(wordleCommunityDailyPresence)
      .innerJoin(
        wordleGlobalSessions,
        and(
          eq(
            wordleCommunityDailyPresence.user_id,
            wordleGlobalSessions.user_id,
          ),
          eq(
            wordleCommunityDailyPresence.word_date,
            wordleGlobalSessions.word_date,
          ),
        ),
      )
      .where(
        and(
          eq(wordleCommunityDailyPresence.guild_id, guildId),
          lt(wordleCommunityDailyPresence.word_date, today),
          or(
            gt(wordleGlobalSessions.attempts, 0),
            eq(wordleGlobalSessions.solved_from_draft, true),
          ),
        ),
      )
      .orderBy(desc(wordleCommunityDailyPresence.word_date));
    let streak = 0;
    let expected = shift(today, -1);
    for (const row of rows) {
      if (row.date !== expected) break;
      streak++;
      expected = shift(expected, -1);
    }
    return streak;
  }
}
