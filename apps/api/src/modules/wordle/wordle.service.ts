import type {
  WordleDraft,
  WordleDraftWrite,
  WordleDraftWriteResult,
} from '@marquinhos/contracts/wordle';
import type { Db } from '@marquinhos/database/client';
import {
  wordleCommunityDailyPresence,
  wordleConfig,
  wordleGlobalDays,
  wordleGlobalSessions,
} from '@marquinhos/database/schema';
import { Inject, Injectable } from '@nestjs/common';
import { DB } from 'database/database.tokens';
import { and, asc, eq, sql } from 'drizzle-orm';
import { WordleParticipationService } from 'modules/wordle/community/wordle-participation.service';
import { buildUniqueDayGuesses } from 'modules/wordle/gameplay/day-guesses';
import { WordleGlobalAnnouncementService } from 'modules/wordle/gameplay/wordle-global-announcement.service';
import { WordleGlobalDayService } from 'modules/wordle/gameplay/wordle-global-day.service';
import { WordleGlobalDraftService } from 'modules/wordle/gameplay/wordle-global-draft.service';
import { WordleGlobalGameCoordinator } from 'modules/wordle/gameplay/wordle-global-game-coordinator';
import { WordleGlobalLeaderboardService } from 'modules/wordle/gameplay/wordle-global-leaderboard.service';
import type {
  DailyStats,
  DayGuesses,
  ForceNewWordResult,
  GuessResult,
  WordleDaily,
  WordleSession,
} from 'modules/wordle/gameplay/wordle.types';
import { WordleGlobalAchievementService } from 'modules/wordle/progression/wordle-global-achievement.service';
import { WordleHistoryService } from 'modules/wordle/progression/wordle-history.service';
import { WORDLE_NOW, WORDLE_TODAY } from 'modules/wordle/wordle.tokens';
import { WordBankService } from 'modules/wordle/words/word-bank.service';

export class GlobalWordleCannotForce extends Error {}

export type {
  DailyStats,
  DayGuesses,
  ForceNewWordResult,
  GuessResult,
} from 'modules/wordle/gameplay/wordle.types';

@Injectable()
export class WordleService {
  constructor(
    @Inject(DB) private readonly database: Db,
    private readonly achievements: WordleGlobalAchievementService,
    private readonly announcements: WordleGlobalAnnouncementService,
    private readonly globalDay: WordleGlobalDayService,
    private readonly drafts: WordleGlobalDraftService,
    private readonly coordinator: WordleGlobalGameCoordinator,
    private readonly leaderboard: WordleGlobalLeaderboardService,
    private readonly participation: WordleParticipationService,
    private readonly wordBank: WordBankService,
    private readonly history: WordleHistoryService,
    @Inject(WORDLE_TODAY) private readonly today: () => string,
    @Inject(WORDLE_NOW) private readonly now: () => number,
  ) {}

  currentDate(): string {
    return this.today();
  }

  getOrCreateDay(date: string) {
    return this.globalDay.getOrCreate(date);
  }

  getAchievementsOverview(userId: string, guildId: string, viewerId: string) {
    return this.achievements.getOverview(userId, guildId, viewerId);
  }

  recordParticipation(userId: string, guildId: string): Promise<void> {
    return this.participation.record(userId, guildId);
  }

  async getDailyWord(
    guildId: string,
    today = this.today(),
  ): Promise<WordleDaily> {
    const day = await this.getOrCreateDay(today);
    const [stored] = await this.database
      .select()
      .from(wordleGlobalDays)
      .where(eq(wordleGlobalDays.word_date, today));
    const [counts] = await this.database
      .select({
        players: sql<number>`count(*) filter (where ${wordleGlobalSessions.attempts} > 0 or ${wordleGlobalSessions.solved_from_draft})::int`,
        winners: sql<number>`count(*) filter (where ${wordleGlobalSessions.solved})::int`,
        attempts: sql<number>`coalesce(sum(case when ${wordleGlobalSessions.solved_from_draft} then 1 else ${wordleGlobalSessions.attempts} end) filter (where ${wordleGlobalSessions.solved}), 0)::int`,
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

  async submitGuess(
    userId: string,
    guildId: string,
    guess: string,
  ): Promise<GuessResult | { error: string }> {
    const date = this.today();
    await this.recordParticipation(userId, guildId);
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

  getUnannouncedWins(guildId: string) {
    return this.announcements.unannounced(guildId, this.today());
  }

  async validateGuess(guildId: string, guess: string) {
    const normalized = guess.trim().toLowerCase();
    const daily = await this.getDailyWord(guildId);
    if (normalized.length !== daily.word_length) {
      return {
        valid: false,
        wordLength: daily.word_length,
        message: `A palavra de hoje tem ${daily.word_length} letras (você digitou ${normalized.length})`,
      };
    }

    const canonical = this.wordBank.resolveCanonical(normalized);
    return {
      valid: canonical !== null,
      wordLength: daily.word_length,
      message: canonical
        ? `"${canonical}" é uma palavra válida`
        : `"${normalized}" não foi encontrada na lista de palavras válidas`,
    };
  }

  async getDailyStats(guildId: string): Promise<DailyStats> {
    const daily = await this.getDailyWord(guildId);
    const avgAttempts =
      daily.winners_count > 0
        ? Math.round((daily.total_attempts / daily.winners_count) * 10) / 10
        : 0;
    return {
      wordDate: daily.word_date,
      wordLength: daily.word_length,
      playersCount: daily.players_count,
      winnersCount: daily.winners_count,
      avgAttempts,
    };
  }

  async getDayGuesses(
    guildId: string,
    date = this.today(),
  ): Promise<DayGuesses | null> {
    if (date < this.today()) await this.finalizeExpiredDrafts();
    const [day] = await this.database
      .select()
      .from(wordleGlobalDays)
      .where(eq(wordleGlobalDays.word_date, date));
    if (!day) return this.history.getLegacyDayGuesses(guildId, date);
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

  async getUserDraft(
    userId: string,
    guildId: string,
  ): Promise<WordleDraft | null> {
    const session = await this.getUserSession(userId, guildId);
    if (session?.solved) return null;
    return this.drafts.getCurrentDraft(
      userId,
      this.today(),
      session?.attempts ?? 0,
      false,
    );
  }

  async writeDraft(
    userId: string,
    guildId: string,
    draft: WordleDraftWrite,
    // Callers that already recorded today's presence (the Activity does on
    // join) skip the extra transaction on every keystroke.
    options: { recordParticipation?: boolean } = {},
  ): Promise<WordleDraftWriteResult> {
    if (draft.date !== this.today()) return { status: 'closed' };
    await this.getOrCreateDay(draft.date);
    if (options.recordParticipation !== false)
      await this.participation.record(userId, guildId);
    return this.drafts.write(userId, draft);
  }

  finalizeExpiredDrafts(): Promise<void> {
    return this.drafts.finalizeExpiredDrafts();
  }

  async getStreak(userId: string, _guildId: string) {
    const stats = await this.history.getStats(userId);
    return { currentStreak: stats.currentStreak, maxStreak: stats.bestStreak };
  }

  getLeaderboard(
    guildId: string,
    limit = 10,
    period: 'all-time' | 'weekly' | 'monthly' | 'daily' = 'all-time',
    date?: string,
    offset = 0,
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

  async setConfig(guildId: string, channelId: string): Promise<void> {
    const now = Math.floor(this.now() / 1000);
    await this.database
      .insert(wordleConfig)
      .values({ guild_id: guildId, channel_id: channelId, updated_at: now })
      .onConflictDoUpdate({
        target: wordleConfig.guild_id,
        set: { channel_id: channelId, updated_at: now },
      });
  }

  async getConfig(guildId: string): Promise<{ channelId: string } | null> {
    const [row] = await this.database
      .select({ channel_id: wordleConfig.channel_id })
      .from(wordleConfig)
      .where(eq(wordleConfig.guild_id, guildId));
    return row ? { channelId: row.channel_id } : null;
  }

  async getAllConfiguredGuilds(): Promise<
    { guildId: string; channelId: string }[]
  > {
    const rows = await this.database
      .select({
        guild_id: wordleConfig.guild_id,
        channel_id: wordleConfig.channel_id,
      })
      .from(wordleConfig);
    return rows.map((row) => ({
      guildId: row.guild_id,
      channelId: row.channel_id,
    }));
  }
}
