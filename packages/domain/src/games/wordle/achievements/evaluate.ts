import { WORDLE_ACHIEVEMENT_CATALOG } from './catalog';
import {
  bestParticipationStreak,
  completeFeedback,
  elapsedSeconds,
  hasCalendarCoverage,
  toAchievementHistoryDay,
  type AchievementHistoryDay,
} from './historyFacts';
import { WORDLE_PATTERN_CATALOG } from './patterns';
import type { WordleAchievementRule } from './rules';
import {
  computeWordlePlayerStats,
  dayNumber,
  playedDays,
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
  solved: AchievementHistoryDay[];
  played: AchievementHistoryDay[];
  today: string;
  discoveryIds: ReadonlySet<string>;
  solvedHours: number[];
}

export interface WordleEvaluationOptions extends WordleStatsOptions {
  timeZone?: string;
  discoveryIds?: ReadonlySet<string>;
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
  const played = playedDays([
    ...new Map(
      days
        .filter((day) => day.date <= options.today)
        .map((day) => [day.date, toAchievementHistoryDay(day)]),
    ).values(),
  ]).map(toAchievementHistoryDay);
  const solved = played.filter((day) => day.solved);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: options.timeZone ?? WORDLE_ACHIEVEMENT_TIME_ZONE,
    hour: 'numeric',
    hourCycle: 'h23',
  });
  return {
    stats: computeWordlePlayerStats(played, { today: options.today }),
    played,
    today: options.today,
    discoveryIds: options.discoveryIds ?? new Set(),
    solved,
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

export function evaluateWordleRule(
  rule: WordleAchievementRule,
  facts: WordleAchievementFacts,
): WordleRuleResult {
  const { stats, solved, solvedHours, played, today, discoveryIds } = facts;
  const matrices = played.flatMap((day) => {
    const feedback = completeFeedback(day);
    return feedback === null ? [] : [{ day, feedback }];
  });
  const evidenced = matrices.filter(({ day }) => day.solved);
  switch (rule.kind) {
    case 'wins':
      return counter(stats.wins, rule.count);
    case 'streak':
      return counter(stats.bestStreak, rule.days);
    case 'played':
      return counter(stats.played, rule.days);
    case 'wins_within':
      return counter(
        solved.filter((day) => day.attempts <= rule.maxAttempts).length,
        rule.count,
      );
    case 'solved_after':
      return flag(solved.some((day) => day.attempts >= rule.minAttempts));
    case 'fast_solve':
      return flag(
        solved.some((day) => {
          const elapsed = elapsedSeconds(day);
          return (
            day.attempts >= rule.minAttempts &&
            elapsed !== null &&
            elapsed <= rule.seconds
          );
        }),
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
    case 'blank_start':
      return flag(
        evidenced.some(
          ({ day, feedback }) =>
            day.attempts >= 2 &&
            day.attempts <= rule.maxAttempts &&
            feedback[0]?.every((f) => f === 'absent'),
        ),
      );
    case 'staircase':
      return flag(
        evidenced.some(({ day, feedback }) => {
          const counts = feedback.map(
            (row) => row.filter((cell) => cell === 'correct').length,
          );
          return (
            day.attempts >= rule.minAttempts &&
            counts.every((count, i) => i === 0 || count > counts[i - 1]!)
          );
        }),
      );
    case 'pattern':
      return flag(discoveryIds.has(rule.patternId));
    case 'pattern_collection':
      return counter(
        WORDLE_PATTERN_CATALOG.filter(
          (pattern) =>
            pattern.family === rule.family && discoveryIds.has(pattern.id),
        ).length,
        rule.count,
      );
    case 'played_streak':
      return counter(bestParticipationStreak(played), rule.days);
    case 'calendar_coverage':
      return flag(hasCalendarCoverage(played, today, rule.period));
    case 'solved_exactly':
      return flag(solved.some((day) => day.attempts === rule.attempts));
    case 'all_yellow_row':
      return flag(
        matrices.some(({ feedback }) =>
          feedback.some((row) => row.every((cell) => cell === 'present')),
        ),
      );
    case 'mixed_rows':
      return flag(
        matrices.some(({ day, feedback }) => {
          let consecutive = 0;
          for (const row of day.solved ? feedback.slice(0, -1) : feedback) {
            consecutive = new Set(row).size === 3 ? consecutive + 1 : 0;
            if (consecutive >= rule.count) return true;
          }
          return false;
        }),
      );
    case 'near_miss':
      return flag(
        matrices.some(
          ({ day, feedback }) =>
            day.solved &&
            feedback
              .slice(0, -1)
              .some(
                (row) =>
                  row.filter((cell) => cell === 'correct').length ===
                  row.length - 1,
              ),
        ),
      );
    case 'expired_unsolved':
      return flag(played.some((day) => !day.solved && day.date < today));
    case 'recovery':
      return flag(
        solved.some((day) =>
          played.some(
            (previous) =>
              !previous.solved &&
              previous.date < today &&
              dayNumber(day.date) - dayNumber(previous.date) === 1,
          ),
        ),
      );
    case 'return_after_gap':
      return flag(
        played.some(
          (day, i) =>
            i > 0 &&
            dayNumber(day.date) - dayNumber(played[i - 1]!.date) - 1 >=
              rule.days,
        ),
      );
    case 'slow_solve':
      return flag(
        solved.some((day) => {
          const elapsed = elapsedSeconds(day);
          return elapsed !== null && elapsed >= rule.seconds;
        }),
      );
    case 'answer_lengths':
      return counter(
        new Set(
          solved
            .map((day) => day.wordLength)
            .filter((length) => length === 5 || length === 6),
        ).size,
        2,
      );
    case 'attempt_variety':
      return counter(
        new Set(
          solved
            .filter((day) => day.attempts <= rule.maxAttempts)
            .map((day) => day.attempts),
        ).size,
        rule.maxAttempts,
      );
    case 'answer_vocabulary':
      return flag(
        solved.some(
          (day) =>
            (rule.feature === 'accent'
              ? day.answerHasAccent
              : day.answerHasRepeatedLetters) === true,
        ),
      );
    default: {
      const exhaustive: never = rule;
      return exhaustive;
    }
  }
}

export function evaluateWordleAchievements(
  days: readonly WordleDayRecord[],
  options: WordleEvaluationOptions,
): WordleAchievementEvaluation[] {
  const facts = buildWordleAchievementFacts(days, options);
  return WORDLE_ACHIEVEMENT_CATALOG.map((definition) => ({
    id: definition.id,
    ...evaluateWordleRule(definition.rule, facts),
  }));
}
