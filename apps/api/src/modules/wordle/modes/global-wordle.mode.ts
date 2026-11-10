import type { GuessRow, WordleDraftWrite } from '@marquinhos/contracts/wordle';
import type { Db } from '@marquinhos/database/client';
import {
  wordleCommunityDailyPresence,
  wordleGlobalDays,
  wordleGlobalSessions,
} from '@marquinhos/database/schema';
import { Inject, Injectable } from '@nestjs/common';
import { DB } from 'database/database.tokens';
import { and, asc, eq, sql } from 'drizzle-orm';
import { buildUniqueDayGuesses } from 'modules/wordle/services/day-guesses';
import { WordleGlobalAchievementService } from 'modules/wordle/services/wordle-global-achievement.service';
import { WordleGlobalAnnouncementService } from 'modules/wordle/services/wordle-global-announcement.service';
import { WordleGlobalDayService } from 'modules/wordle/services/wordle-global-day.service';
import { WordleGlobalDraftService } from 'modules/wordle/services/wordle-global-draft.service';
import { WordleGlobalGameCoordinator } from 'modules/wordle/services/wordle-global-game-coordinator';
import { WordleGlobalLeaderboardService } from 'modules/wordle/services/wordle-global-leaderboard.service';
import { WordleParticipationService } from 'modules/wordle/services/wordle-participation.service';
import { WORDLE_TODAY } from 'modules/wordle/wordle.tokens';
import type {
  DayGuesses,
  ForceNewWordResult,
  WordleDaily,
  WordleGameMode,
  WordleSession,
} from './wordle-game-mode';

export class GlobalWordleCannotForce extends Error {}

@Injectable()
export class GlobalWordleMode implements WordleGameMode {
  constructor(
    @Inject(DB) private readonly database: Db,
    private readonly achievements: WordleGlobalAchievementService,
    private readonly announcements: WordleGlobalAnnouncementService,
    private readonly globalDay: WordleGlobalDayService,
    private readonly drafts: WordleGlobalDraftService,
    private readonly coordinator: WordleGlobalGameCoordinator,
    private readonly leaderboard: WordleGlobalLeaderboardService,
    private readonly participation: WordleParticipationService,
    @Inject(WORDLE_TODAY) private readonly today: () => string,
  ) {}

  getOrCreateDay(date: string) {
    return this.globalDay.getOrCreate(date);
  }

  getAchievementsOverview(userId: string, guildId: string, viewerId: string) {
    return this.achievements.getOverview(userId, guildId, viewerId);
  }

  async getDailyWord(guildId: string, today: string): Promise<WordleDaily> {
    const day = await this.getOrCreateDay(today);
    const [stored] = await this.database
      .select()
      .from(wordleGlobalDays)
      .where(eq(wordleGlobalDays.word_date, today));
    const [counts] = await this.database
      .select({
        players: sql<number>`count(*) filter (where ${wordleGlobalSessions.attempts} > 0 or ${wordleGlobalSessions.solved_from_draft})::int`,
        winners: sql<number>`count(*) filter (where ${wordleGlobalSessions.solved})::int`,
        attempts: sql<number>`coalesce(sum(${wordleGlobalSessions.attempts}) filter (where ${wordleGlobalSessions.solved}), 0)::int`,
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
      .where(
        and(
          eq(wordleCommunityDailyPresence.guild_id, guildId),
          eq(wordleCommunityDailyPresence.word_date, today),
        ),
      );
    return {
      guild_id: guildId,
      word: day.word,
      word_date: today,
      word_length: day.wordLength,
      players_count: counts?.players ?? 0,
      winners_count: counts?.winners ?? 0,
      total_attempts: counts?.attempts ?? 0,
      created_at: stored!.created_at,
    };
  }

  async submitGuess(userId: string, guildId: string, guess: string) {
    const date = this.today();
    await this.drafts.finalizePlayerBefore(userId, date);
    await this.getOrCreateDay(date);
    const result = await this.coordinator.submitGuess(
      userId,
      guildId,
      date,
      guess,
    );
    if ('error' in result || !result.solved) return result;
    const streak =
      ('achievementUpdate' in result
        ? result.achievementUpdate.overview.stats.currentStreak
        : undefined) ?? (await this.getStreak(userId, guildId)).currentStreak;
    return { ...result, streak };
  }

  async getUserSession(
    userId: string,
    guildId: string,
  ): Promise<WordleSession | null> {
    const today = this.today();
    const [row] = await this.database
      .select()
      .from(wordleGlobalSessions)
      .where(
        and(
          eq(wordleGlobalSessions.user_id, userId),
          eq(wordleGlobalSessions.word_date, today),
        ),
      );
    return row
      ? {
          id: row.id,
          user_id: userId,
          guild_id: guildId,
          word_date: today,
          guesses: JSON.parse(row.guesses),
          solved: row.solved,
          solved_from_draft: row.solved_from_draft,
          attempts: row.attempts,
          created_at: row.created_at,
        }
      : null;
  }

  markAnnounced(userId: string, guildId: string): Promise<boolean> {
    return this.announcements.claim(userId, guildId, this.today());
  }

  getUnannouncedWins(
    guildId: string,
  ): Promise<{ userId: string; guesses: GuessRow[]; attempts: number }[]> {
    return this.announcements.unannounced(guildId, this.today());
  }

  async getDayGuesses(
    guildId: string,
    date: string,
  ): Promise<DayGuesses | null> {
    if (date < this.today()) await this.finalizeExpiredDrafts();
    const [day] = await this.database
      .select()
      .from(wordleGlobalDays)
      .where(eq(wordleGlobalDays.word_date, date));
    if (!day) return null;
    const rows = await this.database
      .select({ guesses: wordleGlobalSessions.guesses })
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
      .where(
        and(
          eq(wordleCommunityDailyPresence.guild_id, guildId),
          eq(wordleCommunityDailyPresence.word_date, date),
        ),
      )
      .orderBy(
        asc(wordleGlobalSessions.created_at),
        asc(wordleGlobalSessions.user_id),
      );
    return {
      word: day.word,
      wordDate: day.word_date,
      wordLength: day.word_length,
      guesses: buildUniqueDayGuesses(day.word, rows),
    };
  }

  getCurrentDraft(userId: string, _guildId: string, attempts: number) {
    return this.drafts.getCurrentDraft(userId, this.today(), attempts, false);
  }

  async writeDraft(userId: string, guildId: string, draft: WordleDraftWrite) {
    await this.getOrCreateDay(draft.date);
    await this.participation.record(userId, guildId);
    return this.drafts.write(userId, draft);
  }

  finalizeExpiredDrafts(): Promise<void> {
    return this.drafts.finalizeExpiredDrafts();
  }

  async getStreak(userId: string, _guildId: string) {
    const stats = await this.achievements.getStats(userId);
    return {
      currentStreak: stats.currentStreak,
      maxStreak: stats.bestStreak,
    };
  }

  getLeaderboard(
    guildId: string,
    limit: number,
    period: 'all-time' | 'weekly' | 'monthly' | 'daily',
    date: string | undefined,
    offset: number,
  ) {
    return this.leaderboard.getLeaderboard(
      guildId,
      period,
      period === 'daily' ? (date ?? this.today()) : this.today(),
      limit,
      offset,
    );
  }

  getGroupStreak(guildId: string): Promise<number> {
    return this.leaderboard.getGroupStreak(guildId, this.today());
  }

  forceNewWord(_guildId: string): Promise<ForceNewWordResult> {
    throw new GlobalWordleCannotForce(
      'A palavra global não pode ser trocada antes da virada.',
    );
  }

  rotateDailyWord(_guildId: string) {
    return this.getOrCreateDay(this.today());
  }
}
