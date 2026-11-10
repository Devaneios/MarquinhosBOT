import type {
  forceNewWordResultSchema,
  wordleDailyStatsSchema,
  wordleDayGuessesSchema,
  wordleGuessResultSchema,
  wordleSessionSchema,
} from '@marquinhos/contracts/http/routes/wordle';
import type {
  GuessRow,
  WordleAchievementsOverview,
  WordleDraft,
  WordleDraftWrite,
  WordleDraftWriteResult,
} from '@marquinhos/contracts/wordle';
import type { z } from 'zod';

export type GuessResult = z.output<typeof wordleGuessResultSchema>;
export type DailyStats = z.input<typeof wordleDailyStatsSchema>;
export type ForceNewWordResult = z.input<typeof forceNewWordResultSchema>;
export type DayGuesses = z.input<typeof wordleDayGuessesSchema>;
export type WordleSession = z.input<typeof wordleSessionSchema>;

export interface WordleDaily {
  guild_id: string;
  word: string;
  word_date: string;
  word_length: number;
  players_count: number;
  winners_count: number;
  total_attempts: number;
  created_at: number;
}

export interface WordleLeaderboardEntry {
  userId: string;
  totalDays: number;
  avgScore: number;
}

export interface WordleDailyLeaderboardEntry {
  userId: string;
  attempts: number;
  solved: boolean;
}

export interface WordleGameMode {
  getAchievementsOverview(
    userId: string,
    guildId: string,
    viewerId: string,
  ): Promise<WordleAchievementsOverview>;
  getDailyWord(guildId: string, today: string): Promise<WordleDaily>;
  submitGuess(
    userId: string,
    guildId: string,
    guess: string,
  ): Promise<GuessResult | { error: string }>;
  getUserSession(
    userId: string,
    guildId: string,
  ): Promise<WordleSession | null>;
  markAnnounced(userId: string, guildId: string): Promise<boolean>;
  getUnannouncedWins(
    guildId: string,
  ): Promise<{ userId: string; guesses: GuessRow[]; attempts: number }[]>;
  getDayGuesses(guildId: string, date: string): Promise<DayGuesses | null>;
  getCurrentDraft(
    userId: string,
    guildId: string,
    attempts: number,
  ): Promise<WordleDraft | null>;
  writeDraft(
    userId: string,
    guildId: string,
    draft: WordleDraftWrite,
  ): Promise<WordleDraftWriteResult>;
  finalizeExpiredDrafts(): Promise<void>;
  getStreak(
    userId: string,
    guildId: string,
  ): Promise<{ currentStreak: number; maxStreak: number }>;
  getLeaderboard(
    guildId: string,
    limit: number,
    period: 'all-time' | 'weekly' | 'monthly' | 'daily',
    date: string | undefined,
    offset: number,
  ): Promise<WordleLeaderboardEntry[] | WordleDailyLeaderboardEntry[]>;
  getGroupStreak(guildId: string): Promise<number>;
  forceNewWord(guildId: string): Promise<ForceNewWordResult>;
  rotateDailyWord(guildId: string): Promise<ForceNewWordResult>;
}
