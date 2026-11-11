import type {
  forceNewWordResultSchema,
  wordleDailyStatsSchema,
  wordleDayGuessesSchema,
  wordleGuessResultSchema,
  wordleSessionSchema,
} from '@marquinhos/contracts/http/routes/wordle';
import type { GuessRow } from '@marquinhos/contracts/wordle';
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

export type UnannouncedWordleWin = {
  userId: string;
  guesses: GuessRow[];
  attempts: number;
};
