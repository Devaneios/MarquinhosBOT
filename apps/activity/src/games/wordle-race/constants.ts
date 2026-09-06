import type { LetterFeedback } from './types';

export const FEEDBACK_COLORS: Record<
  LetterFeedback | 'unused',
  { bg: string; text: string }
> = {
  correct: { bg: '#588157', text: '#E8E8E8' },
  present: { bg: '#C0A054', text: '#1C1C1E' },
  absent: { bg: '#3A3A3C', text: '#E8E8E8' },
  unused: { bg: '#818384', text: '#1C1C1E' },
};

export const KB_ROWS = ['qwertyuiop', 'asdfghjklç', 'zxcvbnm'];
export const KB_LETTERS = new Set(KB_ROWS.join(''));
