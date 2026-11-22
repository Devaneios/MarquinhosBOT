import type { AchievementRarity } from './types';

export const ACHIEVEMENT_XP_BY_RARITY: Readonly<
  Record<AchievementRarity, number>
> = {
  common: 25,
  rare: 75,
  epic: 150,
  legendary: 750,
};

export function achievementXpForRarity(rarity: AchievementRarity): number {
  return ACHIEVEMENT_XP_BY_RARITY[rarity];
}
