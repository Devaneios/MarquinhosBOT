import type { WordlePatternEvidence } from '@marquinhos/contracts/wordle';
import { WORDLE_ACHIEVEMENT_CATALOG, WORDLE_DRAWING_CATALOG } from '../catalog';
import { WORDLE_PATTERN_FAMILIES } from '../families';
import type { DrawingDefinition, WordleAchievementFacts } from '../types';
import {
  prepareAchievementHistory,
  type AchievementEvaluationOptions,
  type AchievementHistoryDay,
} from './history';
import { matchWordlePatterns } from './matchPatterns';

export interface WordleAchievementProgress {
  current: number;
  target: number;
}

export interface WordleAchievementEvaluation {
  id: string;
  met: boolean;
  progress: WordleAchievementProgress | null;
}

export type WordleEvaluationOptions = AchievementEvaluationOptions;
export type { AchievementHistoryDay } from './history';

export interface WordleAchievementAnalysis {
  discoverPatterns(
    knownPatternIds: ReadonlySet<string>,
  ): WordlePatternEvidence[];
  evaluate(
    persistedPatternIds: ReadonlySet<string>,
  ): WordleAchievementEvaluation[];
}

function withPersistedPatternIds(
  facts: WordleAchievementFacts,
  drawings: readonly DrawingDefinition[],
  persistedPatternIds: ReadonlySet<string>,
): WordleAchievementFacts {
  const discoveredPatternCounts = Object.fromEntries(
    WORDLE_PATTERN_FAMILIES.map((family) => [family, 0]),
  ) as Record<(typeof WORDLE_PATTERN_FAMILIES)[number], number>;
  for (const drawing of drawings) {
    if (persistedPatternIds.has(drawing.patternId))
      discoveredPatternCounts[drawing.family] += 1;
  }
  return {
    ...facts,
    discoveredPatternIds: persistedPatternIds,
    discoveredPatternCounts,
  };
}

export function analyzeWordleAchievements(
  days: readonly AchievementHistoryDay[],
  options: WordleEvaluationOptions,
): WordleAchievementAnalysis {
  const facts = prepareAchievementHistory(days, options);
  return {
    discoverPatterns(knownPatternIds) {
      const seen = new Set(knownPatternIds);
      const evidence: WordlePatternEvidence[] = [];
      for (const { day, feedback } of facts.boards) {
        for (const match of matchWordlePatterns(feedback)) {
          if (seen.has(match.patternId)) continue;
          seen.add(match.patternId);
          evidence.push({
            ...match,
            feedback: feedback.map((row) => [...row]),
            date: day.date,
          });
        }
      }
      return evidence;
    },
    evaluate(persistedPatternIds) {
      const evaluatedFacts = withPersistedPatternIds(
        facts,
        WORDLE_DRAWING_CATALOG,
        persistedPatternIds,
      );
      return WORDLE_ACHIEVEMENT_CATALOG.map((definition) => {
        const result =
          definition.kind === 'drawing'
            ? definition.evaluate(evaluatedFacts, definition.drawing)
            : definition.evaluate(evaluatedFacts);
        return { id: definition.id, ...result };
      });
    },
  };
}
