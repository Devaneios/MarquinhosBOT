import type { LetterFeedback } from '@marquinhos/contracts/wordle';
import { parseAchievementMatrix } from './matchPatterns';
import { dayNumber, type WordleDayRecord } from './stats';

export interface AchievementHistoryDay extends WordleDayRecord {
  feedback: LetterFeedback[][] | null;
  wordLength: number | null;
  answerHasRepeatedLetters: boolean | null;
  answerHasAccent: boolean | null;
}

export function toAchievementHistoryDay(
  day: WordleDayRecord | AchievementHistoryDay,
): AchievementHistoryDay {
  if ('feedback' in day) return day;
  const wordLength = day.guesses[0]?.feedback.length ?? null;
  return {
    ...day,
    feedback: parseAchievementMatrix(
      JSON.stringify(day.guesses),
      wordLength,
      day.attempts,
    ),
    wordLength,
    answerHasRepeatedLetters: null,
    answerHasAccent: null,
  };
}

export function completeFeedback(
  day: AchievementHistoryDay,
): LetterFeedback[][] | null {
  const matrix = day.feedback;
  if (
    matrix === null ||
    matrix.length !== day.attempts ||
    day.wordLength === null ||
    day.wordLength <= 0 ||
    matrix.some((row) => row.length !== day.wordLength)
  )
    return null;
  if (day.solved && !matrix.at(-1)?.every((cell) => cell === 'correct'))
    return null;
  return matrix;
}

export function elapsedSeconds(day: WordleDayRecord): number | null {
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
  days: readonly WordleDayRecord[],
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
  days: readonly WordleDayRecord[],
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
