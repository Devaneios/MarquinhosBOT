import type { GuessRow } from '@marquinhos/contracts/wordle';
import {
  WORDLE_ACHIEVEMENT_CATALOG,
  type WordleAchievementDefinition,
} from './catalog';
import type { WordleAchievementRule } from './rules';
import {
  computeWordlePlayerStats,
  playedDays,
  solvedRuns,
  type WordleDayRecord,
  type WordlePlayerStats,
  type WordleStatsOptions,
} from './stats';

export const WORDLE_ACHIEVEMENT_TIME_ZONE = 'America/Recife';

export interface WordleAchievementProgress {
  current: number;
  target: number;
}

export interface WordleRuleResult {
  met: boolean;
  progress: WordleAchievementProgress | null;
}

export interface WordleAchievementEvaluation extends WordleRuleResult {
  id: string;
}

export interface WordleAchievementFacts {
  stats: WordlePlayerStats;
  solved: WordleDayRecord[];
  runs: number[];
  solvedHours: number[];
}

export interface WordleEvaluationOptions extends WordleStatsOptions {
  timeZone?: string;
}

function localHour(epochSeconds: number, formatter: Intl.DateTimeFormat) {
  const part = formatter
    .formatToParts(new Date(epochSeconds * 1000))
    .find((p) => p.type === 'hour');
  return Number(part?.value ?? 0) % 24;
}

export function buildWordleAchievementFacts(
  days: readonly WordleDayRecord[],
  options: WordleEvaluationOptions,
): WordleAchievementFacts {
  const played = playedDays(days);
  const solved = played.filter((day) => day.solved);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: options.timeZone ?? WORDLE_ACHIEVEMENT_TIME_ZONE,
    hour: 'numeric',
    hourCycle: 'h23',
  });
  return {
    stats: computeWordlePlayerStats(days, options),
    solved,
    runs: solvedRuns(played),
    solvedHours: solved
      .filter((day) => day.solvedAt !== null)
      .map((day) => localHour(day.solvedAt!, formatter)),
  };
}

function counter(current: number, target: number): WordleRuleResult {
  return {
    met: current >= target,
    progress: { current: Math.min(current, target), target },
  };
}

function flag(met: boolean): WordleRuleResult {
  return { met, progress: null };
}

function correctCount(row: GuessRow): number {
  return row.feedback.filter((f) => f === 'correct').length;
}

function isStaircase(guesses: readonly GuessRow[]): boolean {
  return guesses.every(
    (row, i) => i === 0 || correctCount(row) > correctCount(guesses[i - 1]!),
  );
}

function hasCompleteGuesses(day: WordleDayRecord): boolean {
  const width = day.guesses[0]?.feedback.length ?? 0;
  const last = day.guesses.at(-1);
  return (
    width > 0 &&
    day.guesses.length === day.attempts &&
    day.guesses.every((row) => row.feedback.length === width) &&
    last !== undefined &&
    last.feedback.every((f) => f === 'correct')
  );
}

export function evaluateWordleRule(
  rule: WordleAchievementRule,
  facts: WordleAchievementFacts,
): WordleRuleResult {
  const { stats, solved, runs, solvedHours } = facts;
  const evidenced = solved.filter(hasCompleteGuesses);
  switch (rule.kind) {
    case 'wins':
      return counter(stats.wins, rule.count);
    case 'streak':
      return counter(stats.bestStreak, rule.days);
    case 'played':
      return counter(stats.played, rule.days);
    case 'solved_within':
      return flag(solved.some((day) => day.attempts <= rule.maxAttempts));
    case 'wins_within':
      return counter(
        solved.filter((day) => day.attempts <= rule.maxAttempts).length,
        rule.count,
      );
    case 'solved_after':
      return flag(solved.some((day) => day.attempts >= rule.minAttempts));
    case 'fast_solve':
      return flag(
        solved.some(
          (day) =>
            day.solvedAt !== null &&
            day.solvedAt >= day.startedAt &&
            day.attempts >= rule.minAttempts &&
            day.solvedAt - day.startedAt <= rule.seconds,
        ),
      );
    case 'first_solver':
      return counter(
        solved.filter((day) => day.firstSolverInGuild).length,
        rule.count,
      );
    case 'solved_at_hours':
      return flag(
        solvedHours.some((h) => h >= rule.fromHour && h < rule.toHour),
      );
    case 'clean_solve':
      return flag(
        evidenced.some(
          (day) =>
            day.attempts >= rule.minAttempts &&
            day.guesses.every((row) => !row.feedback.includes('present')),
        ),
      );
    case 'blank_start':
      return flag(
        evidenced.some(
          (day) =>
            day.attempts >= 2 &&
            day.attempts <= rule.maxAttempts &&
            day.guesses[0]!.feedback.every((f) => f === 'absent'),
        ),
      );
    case 'staircase':
      return flag(
        evidenced.some(
          (day) => day.attempts >= rule.minAttempts && isStaircase(day.guesses),
        ),
      );
    case 'phoenix':
      return flag(runs.filter((length) => length >= rule.days).length >= 2);
  }
}

export function evaluateWordleAchievements(
  days: readonly WordleDayRecord[],
  options: WordleEvaluationOptions,
  catalog: readonly WordleAchievementDefinition[] = WORDLE_ACHIEVEMENT_CATALOG,
): WordleAchievementEvaluation[] {
  const facts = buildWordleAchievementFacts(days, options);
  return catalog.map((definition) => ({
    id: definition.id,
    ...evaluateWordleRule(definition.rule, facts),
  }));
}
