import type { GuessRow, LetterFeedback } from '@marquinhos/contracts/wordle';
import type { WordleDayRecord } from '../playerStats';
import type { AchievementHistoryDay } from './engine/history';

const CODES: Record<string, LetterFeedback> = {
  c: 'correct',
  p: 'present',
  a: 'absent',
};

export function rows(...patterns: string[]): GuessRow[] {
  return patterns.map((pattern) => ({
    guess: 'x'.repeat(pattern.length),
    feedback: pattern.split('').map((code) => CODES[code]!),
  }));
}

export function epoch(iso: string): number {
  return Math.floor(Date.parse(iso) / 1000);
}

export function addDays(date: string, offset: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

export function solvedDay(
  date: string,
  overrides: Partial<WordleDayRecord> = {},
): WordleDayRecord {
  const guesses = overrides.guesses ?? rows('apaaa', 'ccccc');
  const startedAt = overrides.startedAt ?? epoch(`${date}T15:00:00Z`);
  return {
    date,
    solved: true,
    attempts: guesses.length,
    guesses,
    startedAt,
    solvedAt: startedAt + 120,
    firstSolverInGuild: false,
    ...overrides,
  };
}

export function achievementDay(
  day: WordleDayRecord,
  facts: Partial<
    Pick<
      AchievementHistoryDay,
      'wordLength' | 'answerHasAccent' | 'answerHasRepeatedLetters'
    >
  > = {},
): AchievementHistoryDay {
  return {
    ...day,
    wordLength: day.guesses[0]?.guess.length ?? null,
    answerHasAccent: null,
    answerHasRepeatedLetters: null,
    ...facts,
  };
}

export function failedDay(
  date: string,
  overrides: Partial<WordleDayRecord> = {},
): WordleDayRecord {
  const guesses = overrides.guesses ?? rows('apaaa', 'ccpaa');
  return {
    date,
    solved: false,
    attempts: guesses.length,
    guesses,
    startedAt: epoch(`${date}T15:00:00Z`),
    solvedAt: null,
    firstSolverInGuild: false,
    ...overrides,
  };
}

export function solvedStreak(
  start: string,
  length: number,
  overrides: Partial<WordleDayRecord> = {},
): WordleDayRecord[] {
  return Array.from({ length }, (_, i) =>
    solvedDay(addDays(start, i), overrides),
  );
}
