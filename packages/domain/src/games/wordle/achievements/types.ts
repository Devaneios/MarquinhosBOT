import type { achievementRaritySchema } from '@marquinhos/contracts/http/routes/gamification';
import type { WordlePatternPreview } from '@marquinhos/contracts/wordle';
import type { z } from 'zod';
import type { WORDLE_ACHIEVEMENT_VERSION } from './catalog';
import type { WordleAchievementRule } from './engine/rules';
import type { WordleAchievementFamily, WordlePatternFamily } from './families';

export type AchievementRarity = z.infer<typeof achievementRaritySchema>;

export interface AchievementSpec {
  id: `wordle_v${typeof WORDLE_ACHIEVEMENT_VERSION}_${string}`;
  family: WordleAchievementFamily;
  name: string;
  description: string;
  rarity: AchievementRarity;
  rule: WordleAchievementRule;
  icon?: string;
  rewardXp?: number;
  hidden?: boolean;
}

export interface WordleAchievementDefinition extends Omit<
  AchievementSpec,
  'id'
> {
  id: string;
  tier: number;
  icon: string;
  rewardXp: number;
  hidden: boolean;
  patternPreview?: WordlePatternPreview;
}

export interface PatternSpec {
  id: string;
  family: WordlePatternFamily;
  name: string;
  mask: string;
  /** Wider alternative drawings of the same pattern; the base mask is the minimum width. */
  variants?: readonly string[];
  colors?: WordlePatternPreview['colors'];
  rotations?: WordlePatternPreview['rotations'];
}

export interface WordlePatternDefinition extends WordlePatternPreview {
  id: string;
  family: WordlePatternFamily;
  name: string;
}
