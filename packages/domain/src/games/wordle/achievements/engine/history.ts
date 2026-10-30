import type { LetterFeedback } from '@marquinhos/contracts/wordle';
import {
  computeWordlePlayerStats,
  dayNumber,
  type WordleDayRecord,
  type WordlePlayerStats,
} from '../../playerStats';
import { WORDLE_PATTERN_FAMILIES } from '../families';
import type {
  ReadonlyAchievementDay,
  ValidatedBoard,
  WordleAchievementFacts,
} from '../types';

export const WORDLE_ACHIEVEMENT_TIME_ZONE = 'America/Recife';

export interface AchievementHistoryDay extends WordleDayRecord {
  wordLength: number | null;
  answerHasRepeatedLetters: boolean | null;
  answerHasAccent: boolean | null;
}

export interface AchievementEvaluationOptions {
  today: string;
  timeZone?: string;
}

function completeFeedback(
  day: Pick<AchievementHistoryDay, 'attempts' | 'wordLength' | 'solved'> & {
    readonly guesses: readonly {
      readonly guess: string;
      readonly feedback: readonly LetterFeedback[];
    }[];
  },
): readonly (readonly LetterFeedback[])[] | null {
  if (
    day.guesses.length === 0 ||
    day.guesses.length !== day.attempts ||
    day.wordLength === null ||
    day.wordLength <= 0 ||
    day.guesses.some(
      ({ guess, feedback }) =>
        guess.length !== day.wordLength || feedback.length !== day.wordLength,
    )
  )
    return null;

  const feedback = day.guesses.map((guess) => guess.feedback);
  if (day.solved && !feedback.at(-1)?.every((cell) => cell === 'correct'))
    return null;
  return feedback;
}

export function elapsedSeconds(
  day: Pick<WordleDayRecord, 'startedAt' | 'solvedAt'>,
): number | null {
  if (
    day.solvedAt === null ||
    !Number.isFinite(day.solvedAt) ||
    !Number.isFinite(day.startedAt) ||
    day.startedAt <= 0 ||
    day.solvedAt < day.startedAt
  )
    return null;
  return day.solvedAt - day.startedAt;
}

export function bestParticipationStreak(
  days: readonly Pick<WordleDayRecord, 'date'>[],
): number {
  let best = 0;
  let current = 0;
  let previous: number | undefined;
  for (const day of days) {
    const date = dayNumber(day.date);
    current = previous !== undefined && date === previous + 1 ? current + 1 : 1;
    best = Math.max(best, current);
    previous = date;
  }
  return best;
}

export function hasCalendarCoverage(
  days: readonly Pick<WordleDayRecord, 'date'>[],
  today: string,
  period: 'week' | 'month',
): boolean {
  const played = new Set(days.map((day) => dayNumber(day.date)));
  for (const day of days) {
    const start = new Date(`${day.date}T00:00:00Z`);
    if (period === 'week' && start.getUTCDay() !== 1) continue;
    if (period === 'month' && start.getUTCDate() !== 1) continue;
    const end = new Date(start);
    if (period === 'week') end.setUTCDate(end.getUTCDate() + 7);
    else end.setUTCMonth(end.getUTCMonth() + 1);
    const startNumber = dayNumber(day.date);
    const endNumber = Math.round(end.getTime() / 86_400_000);
    if (endNumber > dayNumber(today)) continue;
    if (
      Array.from(
        { length: endNumber - startNumber },
        (_, i) => startNumber + i,
      ).every((date) => played.has(date))
    )
      return true;
  }
  return false;
}

function localHour(epochSeconds: number, formatter: Intl.DateTimeFormat) {
  const part = formatter
    .formatToParts(new Date(epochSeconds * 1000))
    .find((candidate) => candidate.type === 'hour');
  return Number(part?.value ?? 0) % 24;
}

export function prepareAchievementHistory(
  days: readonly AchievementHistoryDay[],
  options: AchievementEvaluationOptions,
): WordleAchievementFacts {
  const played: ReadonlyAchievementDay[] = [
    ...new Map(
      days
        .filter(
          (day) =>
            (day.attempts > 0 ||
              (day.solved && day.solvedFromDraft && day.attempts === 0)) &&
            day.date <= options.today,
        )
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((day) => [day.date, day]),
    ).values(),
  ];
  const solved = played.filter((day) => day.solved);
  const boards: ValidatedBoard[] = played.flatMap((day) => {
    const feedback = completeFeedback(day);
    return feedback === null ? [] : [{ day, feedback }];
  });
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: options.timeZone ?? WORDLE_ACHIEVEMENT_TIME_ZONE,
    hour: 'numeric',
    hourCycle: 'h23',
  });
  const solvedHours = solved.flatMap((day) => {
    if (day.solvedAt === null || !Number.isFinite(day.solvedAt)) return [];
    return [localHour(day.solvedAt, formatter)];
  });
  const discoveredPatternCounts = Object.fromEntries(
    WORDLE_PATTERN_FAMILIES.map((family) => [family, 0]),
  ) as Record<(typeof WORDLE_PATTERN_FAMILIES)[number], number>;
  const stats: WordlePlayerStats = computeWordlePlayerStats(played, {
    today: options.today,
  });
  return {
    stats,
    played,
    participated: played.filter((day) => day.attempts > 0),
    solved,
    boards,
    solvedBoards: boards.filter(({ day }) => day.solved),
    today: options.today,
    discoveredPatternIds: new Set<string>(),
    discoveredPatternCounts,
    solvedHours,
  };
}
