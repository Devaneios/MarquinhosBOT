import type { WordlePatternEvidence } from '@marquinhos/contracts/wordle';
import {
  prepareAchievementHistory,
  type AchievementEvaluationOptions,
  type AchievementHistoryDay,
} from './history';
import { matchWordlePatterns } from './matchPatterns';

export function discoverWordlePatterns(
  _days: readonly AchievementHistoryDay[],
  options: Pick<AchievementEvaluationOptions, 'today'>,
): WordlePatternEvidence[] {
  return prepareAchievementHistory(_days, options).matrices.flatMap(
    ({ day, feedback }) =>
      matchWordlePatterns(feedback).map((match) => ({
        ...match,
        feedback,
        date: day.date,
      })),
  );
}
