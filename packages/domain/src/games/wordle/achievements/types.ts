import type {
  LetterFeedback,
  WordlePatternPreview,
} from '@marquinhos/contracts/wordle';
import type { WordlePlayerStats } from '../playerStats';
import type { AchievementHistoryDay } from './engine/history';
import type { WordleAchievementFamily, WordlePatternFamily } from './families';

export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface WordleAchievementResult {
  readonly met: boolean;
  readonly progress: {
    readonly current: number;
    readonly target: number;
  } | null;
}

export type ReadonlyAchievementDay = Omit<
  Readonly<AchievementHistoryDay>,
  'guesses'
> & {
  readonly guesses: readonly {
    readonly guess: string;
    readonly feedback: readonly LetterFeedback[];
  }[];
};

export type ReadonlyWordleStats = Omit<
  Readonly<WordlePlayerStats>,
  'distribution'
> & {
  readonly distribution: readonly number[];
};

export interface ValidatedBoard {
  readonly day: ReadonlyAchievementDay;
  readonly feedback: readonly (readonly LetterFeedback[])[];
}

export interface WordleAchievementFacts {
  readonly today: string;
  readonly stats: ReadonlyWordleStats;
  readonly played: readonly ReadonlyAchievementDay[];
  readonly participated: readonly ReadonlyAchievementDay[];
  readonly solved: readonly ReadonlyAchievementDay[];
  readonly boards: readonly ValidatedBoard[];
  readonly solvedBoards: readonly ValidatedBoard[];
  readonly solvedHours: readonly number[];
  readonly discoveredPatternIds: ReadonlySet<string>;
  readonly discoveredPatternCounts: Readonly<
    Record<WordlePatternFamily, number>
  >;
}

export interface WordleAchievementMetadata {
  readonly id: `wordle_v2_${string}`;
  readonly family: WordleAchievementFamily;
  readonly tier: number;
  readonly name: string;
  readonly description: string;
  readonly rarity: AchievementRarity;
  readonly icon: string;
  readonly rewardXp: number;
  readonly hidden: boolean;
}

export interface DrawingDefinition {
  readonly patternId: string;
  readonly family: WordlePatternFamily;
  readonly mask: readonly string[];
  readonly variants: readonly (readonly string[])[];
  readonly colors: readonly WordlePatternPreview['colors'][number][];
  readonly rotations: readonly WordlePatternPreview['rotations'][number][];
}

export type WordleAchievementDefinition = WordleAchievementMetadata &
  (
    | {
        readonly kind: 'standard';
        readonly drawing?: never;
        readonly evaluate: (
          facts: WordleAchievementFacts,
        ) => WordleAchievementResult;
      }
    | {
        readonly kind: 'drawing';
        readonly drawing: DrawingDefinition;
        readonly evaluate: (
          facts: WordleAchievementFacts,
          drawing: DrawingDefinition,
        ) => WordleAchievementResult;
      }
  );
