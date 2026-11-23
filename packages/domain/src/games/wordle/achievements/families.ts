export const WORDLE_ACHIEVEMENT_FAMILIES = [
  'wins',
  'streak',
  'played',
  'precision',
  'speed',
  'timing',
  'style',
  'calendar',
  'feedback',
  'variety',
  'vocabulary',
  'letters',
  'digits',
  'tetrominoes',
  'shapes',
  'gestures',
  'collections',
] as const;

export type WordleAchievementFamily =
  (typeof WORDLE_ACHIEVEMENT_FAMILIES)[number];

export const WORDLE_PATTERN_FAMILIES = [
  'letter',
  'digit',
  'tetromino',
  'shape',
  'gesture',
] as const;
export type WordlePatternFamily = (typeof WORDLE_PATTERN_FAMILIES)[number];
