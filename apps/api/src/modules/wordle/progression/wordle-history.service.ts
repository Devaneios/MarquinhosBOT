import type { Db, DbExecutor } from '@marquinhos/database/client';
import {
  achievements,
  userAchievements,
  wordleDaily,
  wordleDays,
  wordleGlobalCutovers,
  wordleGlobalSessions,
  wordleLegacyProgress,
  wordleSessions,
} from '@marquinhos/database/schema';
import type { AchievementHistoryDay } from '@marquinhos/domain/games/wordle/achievements/engine/history';
import type { WordlePlayerStats } from '@marquinhos/domain/games/wordle/playerStats';
import { computePreservedWordleStats } from '@marquinhos/domain/games/wordle/progressHistory';
import { stripDiacritics } from '@marquinhos/domain/shared/text/stripDiacritics';
import { Inject, Injectable } from '@nestjs/common';
import { DB } from 'database/database.tokens';
import { and, asc, eq, gte, lt } from 'drizzle-orm';
import { buildUniqueDayGuesses } from '../gameplay/day-guesses';
import type { DayGuesses } from '../gameplay/wordle.types';
import { getRecifeDate } from '../wordle-date';

export interface LegacyUnlock {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
  rewardXp: number;
  unlockedAt: number;
}

@Injectable()
export class WordleHistoryService {
  constructor(@Inject(DB) private readonly database: Db) {}

  private async getCutoverDate(exec: DbExecutor): Promise<string | null> {
    const [receipt] = await exec
      .select({ cutoverDate: wordleGlobalCutovers.cutover_date })
      .from(wordleGlobalCutovers)
      .where(eq(wordleGlobalCutovers.id, 'global-only-v003'));
    return receipt?.cutoverDate ?? null;
  }

  async getStats(
    userId: string,
    today = getRecifeDate(),
    exec: DbExecutor = this.database,
  ): Promise<WordlePlayerStats> {
    const cutoverDate = await this.getCutoverDate(exec);
    const legacyRows = cutoverDate
      ? await exec
          .select()
          .from(wordleSessions)
          .where(
            and(
              eq(wordleSessions.user_id, userId),
              lt(wordleSessions.word_date, cutoverDate),
            ),
          )
      : [];
    const globalRows = cutoverDate
      ? await exec
          .select()
          .from(wordleGlobalSessions)
          .where(
            and(
              eq(wordleGlobalSessions.user_id, userId),
              gte(wordleGlobalSessions.word_date, cutoverDate),
            ),
          )
      : await exec
          .select()
          .from(wordleGlobalSessions)
          .where(eq(wordleGlobalSessions.user_id, userId));
    const [carryover] = await exec
      .select()
      .from(wordleLegacyProgress)
      .where(eq(wordleLegacyProgress.user_id, userId));

    return computePreservedWordleStats(
      [
        ...legacyRows.map((row) => ({
          source: 'legacy' as const,
          sessionId: row.id,
          date: row.word_date,
          solved: row.solved,
          solvedFromDraft: row.solved_from_draft,
          attempts: row.attempts,
        })),
        ...globalRows.map((row) => ({
          source: 'global' as const,
          sessionId: row.id,
          date: row.word_date,
          solved: row.solved,
          solvedFromDraft: row.solved_from_draft,
          attempts: row.attempts,
        })),
      ],
      {
        today,
        carryover: carryover
          ? {
              currentStreak: carryover.current_streak,
              bestStreak: carryover.best_streak,
              lastSolvedDate: carryover.last_solved_date,
            }
          : undefined,
      },
    );
  }

  async getLegacyDayGuesses(
    guildId: string,
    date: string,
    exec: DbExecutor = this.database,
  ): Promise<DayGuesses | null> {
    const cutoverDate = await this.getCutoverDate(exec);
    if (cutoverDate && date >= cutoverDate) return null;
    const [day] = await exec
      .select({ word: wordleDays.word, length: wordleDays.word_length })
      .from(wordleDays)
      .where(
        and(eq(wordleDays.guild_id, guildId), eq(wordleDays.word_date, date)),
      );
    if (!day) {
      const [daily] = await exec
        .select({ word: wordleDaily.word })
        .from(wordleDaily)
        .where(
          and(
            eq(wordleDaily.guild_id, guildId),
            eq(wordleDaily.word_date, date),
          ),
        );
      if (!daily) return null;
      const rows = await exec
        .select({ guesses: wordleSessions.guesses })
        .from(wordleSessions)
        .where(
          and(
            eq(wordleSessions.guild_id, guildId),
            eq(wordleSessions.word_date, date),
          ),
        )
        .orderBy(asc(wordleSessions.created_at));
      return {
        word: daily.word,
        wordDate: date,
        wordLength: daily.word.length,
        guesses: buildUniqueDayGuesses(daily.word, rows),
      };
    }
    if (!day.word) return null;
    const wordLength = day.length ?? day.word.length;
    if (wordLength !== day.word.length) return null;
    const rows = await exec
      .select({ guesses: wordleSessions.guesses })
      .from(wordleSessions)
      .where(
        and(
          eq(wordleSessions.guild_id, guildId),
          eq(wordleSessions.word_date, date),
        ),
      )
      .orderBy(asc(wordleSessions.created_at));
    return {
      word: day.word,
      wordDate: date,
      wordLength,
      guesses: buildUniqueDayGuesses(day.word, rows),
    };
  }

  async getLegacyUnlocks(
    userId: string,
    exec: DbExecutor = this.database,
  ): Promise<LegacyUnlock[]> {
    const rows = await exec
      .select({
        id: userAchievements.achievement_id,
        name: achievements.name,
        description: achievements.description,
        icon: achievements.icon,
        rarity: achievements.rarity,
        rewardXp: achievements.reward_xp,
        unlockedAt: userAchievements.unlocked_at,
      })
      .from(userAchievements)
      .innerJoin(
        achievements,
        eq(userAchievements.achievement_id, achievements.id),
      )
      .where(
        and(
          eq(userAchievements.user_id, userId),
          eq(achievements.category, 'wordle'),
        ),
      )
      .orderBy(
        asc(userAchievements.unlocked_at),
        asc(userAchievements.guild_id),
      );
    const earliest = new Map<string, LegacyUnlock>();
    for (const row of rows) {
      if (!earliest.has(row.id)) earliest.set(row.id, row);
    }
    return [...earliest.values()];
  }

  async getLegacyAchievementHistory(
    userId: string,
    parseGuesses: (raw: string) => AchievementHistoryDay['guesses'],
    exec: DbExecutor = this.database,
  ): Promise<{ cutoverDate: string | null; days: AchievementHistoryDay[] }> {
    const cutoverDate = await this.getCutoverDate(exec);
    if (!cutoverDate) return { cutoverDate: null, days: [] };
    const sessions = await exec
      .select()
      .from(wordleSessions)
      .where(
        and(
          eq(wordleSessions.user_id, userId),
          lt(wordleSessions.word_date, cutoverDate),
        ),
      )
      .orderBy(asc(wordleSessions.word_date), asc(wordleSessions.created_at));
    if (sessions.length === 0) return { cutoverDate, days: [] };

    const [daysRows, dailyRows] = await Promise.all([
      exec
        .select({
          guildId: wordleDays.guild_id,
          wordDate: wordleDays.word_date,
          word: wordleDays.word,
          wordLength: wordleDays.word_length,
        })
        .from(wordleDays)
        .where(lt(wordleDays.word_date, cutoverDate)),
      exec
        .select({
          guildId: wordleDaily.guild_id,
          wordDate: wordleDaily.word_date,
          word: wordleDaily.word,
        })
        .from(wordleDaily)
        .where(lt(wordleDaily.word_date, cutoverDate)),
    ]);

    const answerByGuildDate = new Map<
      string,
      { word: string | null; wordLength: number | null }
    >();
    for (const row of dailyRows) {
      answerByGuildDate.set(`${row.guildId}\u0000${row.wordDate}`, {
        word: row.word,
        wordLength: row.word.length,
      });
    }
    for (const row of daysRows) {
      answerByGuildDate.set(`${row.guildId}\u0000${row.wordDate}`, {
        word: row.word,
        wordLength: row.wordLength ?? (row.word ? row.word.length : null),
      });
    }

    const bestByDate = new Map<string, (typeof sessions)[number]>();
    for (const session of sessions) {
      const existing = bestByDate.get(session.word_date);
      if (!existing) {
        bestByDate.set(session.word_date, session);
        continue;
      }
      if (session.solved && !existing.solved) {
        bestByDate.set(session.word_date, session);
      } else if (
        session.solved === existing.solved &&
        session.attempts > 0 &&
        (existing.attempts <= 0 || session.attempts < existing.attempts)
      ) {
        bestByDate.set(session.word_date, session);
      }
    }

    const days: AchievementHistoryDay[] = [...bestByDate.values()].map(
      (session) => {
        const answer = answerByGuildDate.get(
          `${session.guild_id}\u0000${session.word_date}`,
        );
        const word = answer?.word ?? null;
        const normalized = word ? stripDiacritics(word) : null;
        const rawLength =
          answer?.wordLength ??
          (session.word_length > 0 ? session.word_length : null);
        return {
          date: session.word_date,
          solved: session.solved,
          solvedFromDraft: session.solved_from_draft,
          attempts: session.attempts,
          guesses: parseGuesses(session.guesses),
          wordLength: rawLength && rawLength > 0 ? rawLength : null,
          answerHasRepeatedLetters: normalized
            ? new Set(normalized).size < normalized.length
            : null,
          answerHasAccent: word && normalized ? word !== normalized : null,
          startedAt: session.created_at,
          solvedAt: null,
          firstSolverInGuild: false,
        };
      },
    );

    return { cutoverDate, days };
  }
}
