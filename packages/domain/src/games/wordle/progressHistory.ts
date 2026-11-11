import {
  dayNumber,
  distributionBucket,
  WORDLE_DISTRIBUTION_BUCKETS,
  type WordlePlayerStats,
} from './playerStats';

export interface ProgressRecord {
  source: 'legacy' | 'global';
  sessionId: string;
  date: string;
  solved: boolean;
  solvedFromDraft: boolean;
  attempts: number;
}

export interface StreakCarryover {
  currentStreak: number;
  bestStreak: number;
  lastSolvedDate: string | null;
}

export interface PreservedWordleStatsOptions {
  today: string;
  carryover?: StreakCarryover;
}

function assertDate(value: string): void {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ||
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`Expected a valid ISO date, received ${value}`);
  }
}

function isPlayed(record: ProgressRecord): boolean {
  return record.attempts > 0 || (record.solved && record.solvedFromDraft);
}

function uniqueRecords(records: readonly ProgressRecord[]): ProgressRecord[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    const key = `${record.source}\u0000${record.sessionId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function streakRuns(dates: readonly string[]): number[] {
  const runs: number[] = [];
  let previous: number | null = null;
  for (const date of dates) {
    const current = dayNumber(date);
    if (previous !== null && current === previous) continue;
    if (previous !== null && current - previous === 1)
      runs[runs.length - 1]! += 1;
    else runs.push(1);
    previous = current;
  }
  return runs;
}

/** Combines identity-preserving session counts with date-based streak semantics. */
export function computePreservedWordleStats(
  records: readonly ProgressRecord[],
  options: PreservedWordleStatsOptions,
): WordlePlayerStats {
  assertDate(options.today);
  for (const record of records) assertDate(record.date);
  if (options.carryover?.lastSolvedDate)
    assertDate(options.carryover.lastSolvedDate);
  const played = uniqueRecords(records).filter(isPlayed);
  const solved = played.filter((record) => record.solved);
  const solvedDates = [...new Set(solved.map((record) => record.date))].sort();
  const runs = streakRuns(solvedDates);
  const carryover = options.carryover;
  const anchorDate = carryover?.lastSolvedDate ?? null;
  let currentStreak = 0;

  if (anchorDate && carryover && carryover.currentStreak > 0) {
    const anchorAge = dayNumber(options.today) - dayNumber(anchorDate);
    if (anchorAge >= 0 && anchorAge <= 1) {
      const extensions = solvedDates.filter(
        (date) => dayNumber(date) > dayNumber(anchorDate),
      );
      const first = extensions[0];
      if (!first) currentStreak = carryover.currentStreak;
      else if (dayNumber(first) - dayNumber(anchorDate) === 1) {
        let extended = carryover.currentStreak;
        let previous = dayNumber(anchorDate);
        for (const date of extensions) {
          const current = dayNumber(date);
          if (current - previous !== 1) extended = 1;
          else extended += 1;
          previous = current;
        }
        currentStreak = extended;
      }
    }
  }

  const lastSolvedDate = solvedDates.at(-1);
  if (
    lastSolvedDate &&
    dayNumber(options.today) - dayNumber(lastSolvedDate) <= 1
  ) {
    const withoutAnchor = runs.at(-1) ?? 0;
    if (
      !anchorDate ||
      !carryover ||
      dayNumber(lastSolvedDate) <= dayNumber(anchorDate)
    ) {
      currentStreak = withoutAnchor;
    } else if (dayNumber(solvedDates[0]!) > dayNumber(anchorDate) + 1) {
      currentStreak = withoutAnchor;
    }
  }

  const distribution = new Array<number>(WORDLE_DISTRIBUTION_BUCKETS).fill(0);
  for (const record of solved)
    distribution[distributionBucket(record.attempts)]! += 1;
  const wins = solved.length;
  return {
    played: played.length,
    wins,
    winRate: played.length === 0 ? 0 : Math.round((wins / played.length) * 100),
    currentStreak,
    bestStreak: Math.max(carryover?.bestStreak ?? 0, ...runs, currentStreak),
    distribution,
  };
}
