import type { Db, DbExecutor } from '@marquinhos/database/client';
import {
  achievements,
  userAchievements,
  wordleDaily,
  wordleDays,
  wordleGlobalCutovers,
  wordleGlobalSessionOrigins,
  wordleGlobalSessions,
  wordleLegacyProgress,
  wordleSessions,
} from '@marquinhos/database/schema';
import type { WordlePlayerStats } from '@marquinhos/domain/games/wordle/playerStats';
import { computePreservedWordleStats } from '@marquinhos/domain/games/wordle/progressHistory';
import { Inject, Injectable } from '@nestjs/common';
import { DB } from 'database/database.tokens';
import { and, asc, eq, gte, lt } from 'drizzle-orm';
import type { DayGuesses } from '../modes/wordle-game-mode';
import { buildUniqueDayGuesses } from '../services/day-guesses';
import { getRecifeDate } from '../services/wordle-date';

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
    const origins = await exec
      .select({ sourceSessionId: wordleGlobalSessionOrigins.source_session_id })
      .from(wordleGlobalSessionOrigins);
    const migratedSources = new Set(origins.map((row) => row.sourceSessionId));
    const [carryover] = await exec
      .select()
      .from(wordleLegacyProgress)
      .where(eq(wordleLegacyProgress.user_id, userId));

    return computePreservedWordleStats(
      [
        ...legacyRows
          .filter((row) => !migratedSources.has(row.id))
          .map((row) => ({
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
}
