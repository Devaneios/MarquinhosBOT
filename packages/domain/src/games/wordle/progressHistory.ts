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

function streakRunBounds(
  days: readonly number[],
): Array<{ start: number; end: number; length: number }> {
  const runs: Array<{ start: number; end: number; length: number }> = [];
  for (const day of days) {
    const prev = runs[runs.length - 1];
    if (prev && day === prev.end) continue;
    if (prev && day === prev.end + 1) {
      prev.end = day;
      prev.length += 1;
    } else {
      runs.push({ start: day, end: day, length: 1 });
    }
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
  const carryover = options.carryover;
  const today = dayNumber(options.today);
  const anchor =
    carryover?.lastSolvedDate && carryover.currentStreak > 0
      ? dayNumber(carryover.lastSolvedDate)
      : null;
  const solvedDays = solvedDates.map(dayNumber);
  const runs = streakRunBounds(solvedDays);

  const effectiveRunLength = (run: {
    start: number;
    end: number;
    length: number;
  }): number => {
    // A run that begins on or before the day after the carryover anchor and
    // reaches at least the anchor extends the carried-over streak length.
    if (
      anchor !== null &&
      carryover &&
      carryover.currentStreak > 0 &&
      run.start <= anchor + 1 &&
      run.end >= anchor
    ) {
      return Math.max(run.length, carryover.currentStreak + (run.end - anchor));
    }
    return run.length;
  };

  const effectiveRuns = runs.map(effectiveRunLength);
  const lastRun = runs.at(-1);
  let currentStreak = 0;

  if (lastRun !== undefined && today - lastRun.end <= 1) {
    currentStreak = effectiveRunLength(lastRun);
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
    bestStreak: Math.max(
      carryover?.bestStreak ?? 0,
      ...effectiveRuns,
      currentStreak,
    ),
    distribution,
  };
}
