import { WORDLE_ACHIEVEMENT_CATALOG } from '../catalog';
import { WORDLE_PATTERN_CATALOG } from '../patterns';
import {
  bestParticipationStreak,
  elapsedSeconds,
  hasCalendarCoverage,
  prepareAchievementHistory,
  type AchievementEvaluationOptions,
  type AchievementHistoryDay,
} from './history';
import type { WordleAchievementRule } from './rules';

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

function counter(current: number, target: number): WordleRuleResult {
  return {
    met: current >= target,
    progress: { current: Math.min(current, target), target },
  };
}

function flag(met: boolean): WordleRuleResult {
  return { met, progress: null };
}

function evaluateWordleRule(
  rule: WordleAchievementRule,
  facts: ReturnType<typeof prepareAchievementHistory>,
): WordleRuleResult {
  const {
    stats,
    solved,
    solvedHours,
    played,
    today,
    discoveryIds,
    matrices,
    solvedMatrices,
  } = facts;
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
        solvedMatrices.some(
          ({ day, feedback }) =>
            day.attempts >= 2 && feedback[0]?.every((f) => f === 'absent'),
        ),
      );
    case 'staircase':
      return flag(
        solvedMatrices.some(({ day, feedback }) => {
          const counts = feedback.map(
            (row) => row.filter((cell) => cell === 'correct').length,
          );
          return (
            day.attempts >= rule.minAttempts &&
            counts.every((count, i) => {
              const previous = counts[i - 1];
              return previous === undefined || count > previous;
            })
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
    case 'answer_lengths':
      return counter(
        new Set(
          solved
            .map((day) => day.wordLength)
            .filter((length) => length === 5 || length === 6),
        ).size,
        2,
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

export type WordleEvaluationOptions = AchievementEvaluationOptions;
export type { AchievementHistoryDay } from './history';

export function evaluateWordleAchievements(
  days: readonly AchievementHistoryDay[],
  options: WordleEvaluationOptions,
): WordleAchievementEvaluation[] {
  const facts = prepareAchievementHistory(days, options);
  return WORDLE_ACHIEVEMENT_CATALOG.map((definition) => ({
    id: definition.id,
    ...evaluateWordleRule(definition.rule, facts),
  }));
}
