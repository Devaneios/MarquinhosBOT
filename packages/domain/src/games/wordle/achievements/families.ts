export const WORDLE_ACHIEVEMENT_FAMILIES = [
  'wins',
  'streak',
  'played',
  'precision',
  'speed',
  'timing',
  'style',
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
