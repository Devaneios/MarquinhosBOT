import type { LetterFeedback } from '@marquinhos/contracts/wordle';
import type { KeyboardKeyStyle } from './keyboard';

export type KeyState = LetterFeedback | 'unused';

export const FEEDBACK_COLORS: Record<KeyState, KeyboardKeyStyle> = {
  correct: {
    bg: '#588157',
    text: '#E8E8E8',
    base: ['#4a7a4a', '#3d6b3d'],
    cap: ['#4a7a4a', '#3d6b3d'],
    surface: ['#356335', '#4a7a4a'],
  },
  present: {
    bg: '#C0A054',
    text: '#1C1C1E',
    base: ['#b8944a', '#a07e3a'],
    cap: ['#b8944a', '#a07e3a'],
    surface: ['#8a6e30', '#b8944a'],
  },
  absent: {
    bg: '#3A3A3C',
    text: '#E8E8E8',
    base: ['#424242', '#343434'],
    cap: ['#424242', '#343434'],
    surface: ['#2d2d2d', '#424242'],
  },
  unused: {
    bg: '#818384',
    text: '#1C1C1E',
    base: ['#6e6e6e', '#5a5a5a'],
    cap: ['#6e6e6e', '#5a5a5a'],
    surface: ['#555555', '#6e6e6e'],
  },
};
