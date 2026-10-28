import type { WordlePatternPreview } from '@marquinhos/contracts/wordle';
import type { AchievementRarity } from './types';

export const WORDLE_ACHIEVEMENT_FAMILIES = [
  'wins',
  'streak',
  'played',
  'precision',
  'persistence',
  'speed',
  'timing',
  'style',
  'comeback',
  'participation_streak',
  'calendar',
  'feedback',
  'variety',
  'vocabulary',
  'letters',
  'digits',
  'tetrominoes',
  'shapes',
  'collections',
] as const;

export type WordleAchievementFamily =
  (typeof WORDLE_ACHIEVEMENT_FAMILIES)[number];

export const WORDLE_PATTERN_FAMILIES = [
  'letter',
  'digit',
  'tetromino',
  'shape',
] as const;
export type WordlePatternFamily = (typeof WORDLE_PATTERN_FAMILIES)[number];

export const ACHIEVEMENT_FAMILY_ICONS: Partial<
  Record<WordleAchievementFamily, string>
> = {
  letters: '🔤',
  digits: '🔢',
};

export const PATTERN_FAMILY_DEFAULTS: Record<
  WordlePatternFamily,
  {
    achievementFamily: WordleAchievementFamily;
    rarity: AchievementRarity;
    colors: WordlePatternPreview['colors'];
    rotations: WordlePatternPreview['rotations'];
  }
> = {
  letter: {
    achievementFamily: 'letters',
    rarity: 'rare',
    colors: ['correct', 'present'],
    rotations: [0],
  },
  digit: {
    achievementFamily: 'digits',
    rarity: 'rare',
    colors: ['correct', 'present'],
    rotations: [0],
  },
  tetromino: {
    achievementFamily: 'tetrominoes',
    rarity: 'common',
    colors: ['correct', 'present'],
    rotations: [0, 90, 180, 270],
  },
  shape: {
    achievementFamily: 'shapes',
    rarity: 'rare',
    colors: ['correct', 'present'],
    rotations: [0],
  },
};
