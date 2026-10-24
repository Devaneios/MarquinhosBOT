import type { GuessRow } from '@marquinhos/contracts/wordle';

export interface WordleDayRecord {
  date: string;
  solved: boolean;
  attempts: number;
  guesses: GuessRow[];
  startedAt: number;
  solvedAt: number | null;
  firstSolverInGuild: boolean;
}

export interface WordlePlayerStats {
  played: number;
  wins: number;
  winRate: number;
  currentStreak: number;
  bestStreak: number;
  distribution: number[];
}

export interface WordleStatsOptions {
  today: string;
  persistedBestStreak?: number;
}

export const WORDLE_DISTRIBUTION_BUCKETS = 7;

const DAY_MS = 86_400_000;

export function dayNumber(date: string): number {
  return Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
}

export function playedDays(
  days: readonly WordleDayRecord[],
): WordleDayRecord[] {
  return days
    .filter((day) => day.attempts > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function solvedRuns(played: readonly WordleDayRecord[]): number[] {
  const runs: number[] = [];
  let previous: number | null = null;
  for (const day of played) {
    if (!day.solved) continue;
    const current = dayNumber(day.date);
    if (previous !== null && current - previous === 1) {
      runs[runs.length - 1]! += 1;
    } else if (previous !== current) {
      runs.push(1);
    }
    previous = current;
  }
  return runs;
}

export function distributionBucket(attempts: number): number {
  return Math.min(Math.max(attempts, 1), WORDLE_DISTRIBUTION_BUCKETS) - 1;
}

export function computeWordlePlayerStats(
  days: readonly WordleDayRecord[],
  options: WordleStatsOptions,
): WordlePlayerStats {
  const played = playedDays(days);
  const solved = played.filter((day) => day.solved);
  const runs = solvedRuns(played);
  const distribution = new Array<number>(WORDLE_DISTRIBUTION_BUCKETS).fill(0);
  for (const day of solved) {
    distribution[distributionBucket(day.attempts)]! += 1;
  }

  const lastSolved = solved.at(-1);
  const alive =
    lastSolved !== undefined &&
    dayNumber(options.today) - dayNumber(lastSolved.date) <= 1;

  return {
    played: played.length,
    wins: solved.length,
    winRate:
      played.length === 0
        ? 0
        : Math.round((solved.length / played.length) * 100),
    currentStreak: alive ? (runs.at(-1) ?? 0) : 0,
    bestStreak: Math.max(0, options.persistedBestStreak ?? 0, ...runs),
    distribution,
  };
}
