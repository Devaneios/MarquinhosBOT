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
  const today = dayNumber(options.today);
  const anchor =
    carryover?.lastSolvedDate && carryover.currentStreak > 0
      ? dayNumber(carryover.lastSolvedDate)
      : null;
  const solvedDays = solvedDates.map(dayNumber);
  const lastSolved = solvedDays.at(-1);
  let currentStreak = 0;

  if (lastSolved !== undefined && today - lastSolved <= 1) {
    // The run of consecutive solved days that ends on the last solve.
    let runStart = lastSolved;
    for (let index = solvedDays.length - 2; index >= 0; index--) {
      if (solvedDays[index] !== runStart - 1) break;
      runStart -= 1;
    }
    // A run that reaches back to the day after the anchor continues the
    // carried streak, however long ago the cutover was.
    currentStreak =
      anchor !== null &&
      carryover &&
      lastSolved > anchor &&
      runStart <= anchor + 1
        ? carryover.currentStreak + (lastSolved - anchor)
        : lastSolved - runStart + 1;
  } else if (
    anchor !== null &&
    carryover &&
    today - anchor >= 0 &&
    today - anchor <= 1
  ) {
    currentStreak = carryover.currentStreak;
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
