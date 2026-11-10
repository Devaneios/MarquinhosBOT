import type {
  GuessRow,
  WordleDraft,
  WordleDraftWrite,
  WordleDraftWriteResult,
} from '@marquinhos/contracts/wordle';
import type { Db } from '@marquinhos/database/client';
import {
  wordleConfig,
  wordleGlobalMigrationState,
} from '@marquinhos/database/schema';
import { Inject, Injectable } from '@nestjs/common';
import { DB } from 'database/database.tokens';
import { eq } from 'drizzle-orm';
import { GlobalWordleMode } from 'modules/wordle/modes/global-wordle.mode';
import { GuildWordleMode } from 'modules/wordle/modes/guild-wordle.mode';
import type {
  DailyStats,
  DayGuesses,
  ForceNewWordResult,
  GuessResult,
  WordleDaily,
  WordleGameMode,
  WordleSession,
} from 'modules/wordle/modes/wordle-game-mode';
import { WordBankService } from 'modules/wordle/services/word-bank.service';
import { WordleParticipationService } from 'modules/wordle/services/wordle-participation.service';
import { WORDLE_NOW, WORDLE_TODAY } from 'modules/wordle/wordle.tokens';

export { GlobalWordleCannotForce } from 'modules/wordle/modes/global-wordle.mode';
export type {
  DailyStats,
  DayGuesses,
  ForceNewWordResult,
  GuessResult,
} from 'modules/wordle/modes/wordle-game-mode';

@Injectable()
export class WordleService {
  constructor(
    @Inject(DB) private readonly database: Db,
    private readonly participation: WordleParticipationService,
    private readonly wordBank: WordBankService,
    private readonly globalMode: GlobalWordleMode,
    private readonly guildMode: GuildWordleMode,
    @Inject(WORDLE_TODAY) private readonly today: () => string,
    @Inject(WORDLE_NOW) private readonly now: () => number,
  ) {}

  async isGlobalActive(): Promise<boolean> {
    const [state] = await this.database
      .select({ id: wordleGlobalMigrationState.id })
      .from(wordleGlobalMigrationState)
      .where(eq(wordleGlobalMigrationState.id, 'legacy-wordle'));
    return !!state;
  }

  private async mode(): Promise<WordleGameMode> {
    if (await this.isGlobalActive()) return this.globalMode;
    return this.guildMode;
  }

  async getAchievementsOverview(
    userId: string,
    guildId: string,
    viewerId: string,
  ) {
    return (await this.mode()).getAchievementsOverview(
      userId,
      guildId,
      viewerId,
    );
  }

  recordParticipation(userId: string, guildId: string): Promise<void> {
    return this.participation.record(userId, guildId);
  }

  getDailyWord(
    guildId: string,
    today: string = this.today(),
  ): Promise<WordleDaily> {
    return this.mode().then((mode) => mode.getDailyWord(guildId, today));
  }

  async submitGuess(
    userId: string,
    guildId: string,
    guess: string,
  ): Promise<GuessResult | { error: string }> {
    await this.recordParticipation(userId, guildId);
    return (await this.mode()).submitGuess(userId, guildId, guess);
  }

  getUserSession(
    userId: string,
    guildId: string,
  ): Promise<WordleSession | null> {
    return this.mode().then((mode) => mode.getUserSession(userId, guildId));
  }

  markAnnounced(userId: string, guildId: string): Promise<boolean> {
    return this.mode().then((mode) => mode.markAnnounced(userId, guildId));
  }

  getUnannouncedWins(
    guildId: string,
  ): Promise<{ userId: string; guesses: GuessRow[]; attempts: number }[]> {
    return this.mode().then((mode) => mode.getUnannouncedWins(guildId));
  }

  async validateGuess(
    guildId: string,
    guess: string,
  ): Promise<{ valid: boolean; wordLength: number; message: string }> {
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

  getDayGuesses(
    guildId: string,
    date: string = this.today(),
  ): Promise<DayGuesses | null> {
    return this.mode().then((mode) => mode.getDayGuesses(guildId, date));
  }

  async getUserDraft(
    userId: string,
    guildId: string,
  ): Promise<WordleDraft | null> {
    const session = await this.getUserSession(userId, guildId);
    if (session?.solved) return null;
    return (await this.mode()).getCurrentDraft(
      userId,
      guildId,
      session?.attempts ?? 0,
    );
  }

  async writeDraft(
    userId: string,
    guildId: string,
    draft: WordleDraftWrite,
  ): Promise<WordleDraftWriteResult> {
    if (draft.date !== this.today()) return { status: 'closed' };
    return (await this.mode()).writeDraft(userId, guildId, draft);
  }

  finalizeExpiredDrafts(): Promise<void> {
    return this.mode().then((mode) => mode.finalizeExpiredDrafts());
  }

  getStreak(
    userId: string,
    guildId: string,
  ): Promise<{ currentStreak: number; maxStreak: number }> {
    return this.mode().then((mode) => mode.getStreak(userId, guildId));
  }

  getLeaderboard(
    guildId: string,
    limit = 10,
    period: 'all-time' | 'weekly' | 'monthly' | 'daily' = 'all-time',
    date?: string,
    offset = 0,
  ): ReturnType<WordleGameMode['getLeaderboard']> {
    return this.mode().then((mode) =>
      mode.getLeaderboard(guildId, limit, period, date, offset),
    );
  }

  getGroupStreak(guildId: string): Promise<number> {
    return this.mode().then((mode) => mode.getGroupStreak(guildId));
  }

  forceNewWord(guildId: string): Promise<ForceNewWordResult> {
    return this.mode().then((mode) => mode.forceNewWord(guildId));
  }

  rotateDailyWord(guildId: string): Promise<ForceNewWordResult> {
    return this.mode().then((mode) => mode.rotateDailyWord(guildId));
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
