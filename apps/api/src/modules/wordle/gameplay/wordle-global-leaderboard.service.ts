import type { Db } from '@marquinhos/database/client';
import { wordleGlobalCutovers } from '@marquinhos/database/schema';
import { Inject, Injectable } from '@nestjs/common';
import { DB } from 'database/database.tokens';
import { eq, sql } from 'drizzle-orm';
import { getWordleTimeZone } from 'modules/wordle/wordle-date';

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

@Injectable()
export class WordleGlobalLeaderboardService {
  constructor(@Inject(DB) private readonly database: Db) {}

  private async getCutoverDate(): Promise<string> {
    const [receipt] = await this.database
      .select({ date: wordleGlobalCutovers.cutover_date })
      .from(wordleGlobalCutovers)
      .where(eq(wordleGlobalCutovers.id, 'global-only-v003'));
    return receipt?.date ?? '0001-01-01';
  }

  async getLeaderboard(
    guildId: string,
    period: Period,
    today: string,
    limit: number,
    offset = 0,
  ): Promise<GlobalDailyEntry[] | GlobalRankedEntry[]> {
    const cutoverDate = await this.getCutoverDate();
    if (period === 'daily') {
      if (today < cutoverDate) {
        const rows = await this.database.execute<{
          user_id: string;
          attempts: number;
          solved: boolean;
        }>(sql`
          SELECT user_id, attempts, solved FROM wordle_sessions
          WHERE guild_id = ${guildId} AND word_date = ${today}
            AND (attempts > 0 OR solved_from_draft)
          ORDER BY solved DESC, attempts ASC, created_at ASC, user_id ASC
          LIMIT ${limit} OFFSET ${offset}
        `);
        return rows.map((row) => ({
          userId: row.user_id,
          attempts: row.attempts,
          solved: row.solved,
        }));
      }
      const rows = await this.database.execute<{
        user_id: string;
        attempts: number;
        solved: boolean;
      }>(sql`
        SELECT s.user_id, s.attempts, s.solved
        FROM wordle_community_daily_presence p
        JOIN wordle_global_sessions s ON s.user_id = p.user_id AND s.word_date = p.word_date
        WHERE p.guild_id = ${guildId} AND p.word_date = ${today}
          AND (s.attempts > 0 OR s.solved_from_draft)
        ORDER BY s.solved DESC, s.attempts ASC, s.created_at ASC, s.user_id ASC
        LIMIT ${limit} OFFSET ${offset}
      `);
      return rows.map((row) => ({
        userId: row.user_id,
        attempts: row.attempts,
        solved: row.solved,
      }));
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
      ), session_scores AS (
        SELECT s.user_id, s.word_date, s.attempts, s.solved, s.word_length
        FROM wordle_sessions s
        WHERE s.guild_id = ${guildId} AND s.word_date < ${cutoverDate}
          AND (s.attempts > 0 OR s.solved_from_draft)
        UNION ALL
        SELECT s.user_id, s.word_date, s.attempts, s.solved, d.word_length
        FROM wordle_community_daily_presence p
        JOIN wordle_global_sessions s ON s.user_id = p.user_id AND s.word_date = p.word_date
        JOIN wordle_global_days d ON d.word_date = s.word_date
        WHERE p.guild_id = ${guildId} AND s.word_date >= ${cutoverDate}
          AND (s.attempts > 0 OR s.solved_from_draft)
      ), eligible_days AS (
        SELECT word_date, max(word_length)::int AS word_length
        FROM session_scores
        WHERE word_date BETWEEN ${from} AND ${today}
        GROUP BY word_date
      )
      SELECT m.user_id, count(d.word_date)::int AS total_days,
        round(sum(coalesce(s.attempts, d.word_length + 1))::numeric / count(d.word_date), 2)::float8 AS avg_score
      FROM members m JOIN eligible_days d ON d.word_date >= m.joined_on
      LEFT JOIN session_scores s ON s.user_id = m.user_id AND s.word_date = d.word_date
      WHERE d.word_date BETWEEN ${from} AND ${today}
        AND EXISTS (
          SELECT 1 FROM session_scores played
          WHERE played.user_id = m.user_id AND played.word_date BETWEEN greatest(m.joined_on, ${from}) AND ${today}
        )
      GROUP BY m.user_id ORDER BY avg_score ASC, m.user_id ASC LIMIT ${limit} OFFSET ${offset}
    `);
    return rows.map((row) => ({
      userId: row.user_id,
      totalDays: row.total_days,
      avgScore: row.avg_score,
    }));
  }

  async getGroupStreak(guildId: string, today: string): Promise<number> {
    const cutoverDate = await this.getCutoverDate();
    const rows = await this.database.execute<{ date: string }>(sql`
      SELECT DISTINCT word_date AS date FROM (
        SELECT word_date FROM wordle_sessions
        WHERE guild_id = ${guildId} AND word_date < ${cutoverDate} AND word_date < ${today}
          AND (attempts > 0 OR solved_from_draft)
        UNION ALL
        SELECT s.word_date FROM wordle_community_daily_presence p
        JOIN wordle_global_sessions s ON s.user_id = p.user_id AND s.word_date = p.word_date
        WHERE p.guild_id = ${guildId} AND s.word_date >= ${cutoverDate} AND s.word_date < ${today}
          AND (s.attempts > 0 OR s.solved_from_draft)
      ) active_days ORDER BY date DESC
    `);
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
