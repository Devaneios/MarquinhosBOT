import type { WordleAchievementStatus } from '@marquinhos/contracts/wordle';

export type AchievementRarity = WordleAchievementStatus['rarity'];

export const ACHIEVEMENT_RARITY_PALETTES = {
  common: {
    base: '#818384',
    highlight: '#a6a6a8',
    shadow: '#3a3a3c',
    deep: '#121213',
  },
  rare: {
    base: '#5facfb',
    highlight: '#b9ddff',
    shadow: '#32689b',
    deep: '#173554',
  },
  epic: {
    base: '#e5484d',
    highlight: '#ff8f70',
    shadow: '#d6432e',
    deep: '#8b2b27',
  },
  legendary: {
    base: '#ffb000',
    highlight: '#ffe6a3',
    shadow: '#c0a054',
    deep: '#79502e',
  },
} as const satisfies Record<
  AchievementRarity,
  { base: string; highlight: string; shadow: string; deep: string }
>;
