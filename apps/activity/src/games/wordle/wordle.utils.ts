import { KB_LETTERS } from './constants';
import type { GuessRow, LetterFeedback } from './types';

export function normalizeKey(ch: string): string {
  const lower = ch.toLowerCase();
  if (KB_LETTERS.has(lower)) return lower;
  const stripped = lower.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  return KB_LETTERS.has(stripped) ? stripped : lower;
}

export function buildLetterStates(
  guesses: GuessRow[],
): Record<string, LetterFeedback> {
  const priority: Record<LetterFeedback, number> = {
    correct: 3,
    present: 2,
    absent: 1,
  };
  const state: Record<string, LetterFeedback> = {};
  for (const { guess, feedback } of guesses) {
    for (let index = 0; index < guess.length; index++) {
      const key = normalizeKey(guess[index]);
      const current = state[key];
      if (!current || priority[feedback[index]] > priority[current]) {
        state[key] = feedback[index];
      }
    }
  }
  return state;
}
