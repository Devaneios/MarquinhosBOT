import { COLLECTIONS } from './content/collections';
import { GAMEPLAY } from './content/gameplay';
import { MILESTONES } from './content/milestones';
import {
  ACHIEVEMENT_FAMILY_ICONS,
  PATTERN_FAMILY_DEFAULTS,
  type WordleAchievementFamily,
} from './families';
import { getWordlePatternPreview, WORDLE_PATTERN_CATALOG } from './patterns';
import type {
  AchievementRarity,
  AchievementSpec,
  WordleAchievementDefinition,
} from './types';

export const WORDLE_ACHIEVEMENT_VERSION = 2;
// Increment whenever a persisted field changes; catalog.test.ts enforces it.
export const WORDLE_ACHIEVEMENT_CATALOG_REVISION = 2;

const XP: Record<AchievementRarity, number> = {
  common: 25,
  rare: 75,
  epic: 150,
  legendary: 300,
};

function achievement(spec: AchievementSpec): WordleAchievementDefinition {
  return {
    id: spec.id,
    family: spec.family,
    tier: 1,
    name: spec.name,
    description: spec.description,
    icon: spec.icon ?? ACHIEVEMENT_FAMILY_ICONS[spec.family] ?? '🏅',
    rarity: spec.rarity,
    rewardXp: spec.rewardXp ?? XP[spec.rarity],
    hidden: spec.hidden ?? false,
    rule: spec.rule,
  };
}

const drawings = WORDLE_PATTERN_CATALOG.map((pattern) => ({
  ...achievement({
    id: `wordle_v${WORDLE_ACHIEVEMENT_VERSION}_pattern_${pattern.id}`,
    family: PATTERN_FAMILY_DEFAULTS[pattern.family].achievementFamily,
    name: pattern.name,
    description: `Forme ${pattern.name.toLowerCase()} com células verdes ou amarelas. Outra célula da mesma cor ao redor, inclusive na diagonal, muda a figura. A linha vencedora só conta quando o desenho a ocupa.`,
    rarity: PATTERN_FAMILY_DEFAULTS[pattern.family].rarity,
    rule: { kind: 'pattern', patternId: pattern.id },
  }),
  patternPreview: getWordlePatternPreview(pattern.id),
}));

const tiers = new Map<WordleAchievementFamily, number>();
export const WORDLE_ACHIEVEMENT_CATALOG: readonly WordleAchievementDefinition[] =
  [
    ...MILESTONES.map(achievement),
    ...GAMEPLAY.map(achievement),
    ...drawings,
    ...COLLECTIONS.map(achievement),
  ].map((definition) => {
    const tier = (tiers.get(definition.family) ?? 0) + 1;
    tiers.set(definition.family, tier);
    return { ...definition, tier };
  });
