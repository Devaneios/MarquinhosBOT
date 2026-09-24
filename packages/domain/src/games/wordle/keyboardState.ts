import type { GuessRow, LetterFeedback } from '@marquinhos/contracts/wordle';
import { stripDiacritics } from '@marquinhos/domain/shared/text/stripDiacritics';

export function normalizeKey(ch: string, letters: ReadonlySet<string>): string {
  const lower = ch.toLowerCase();
  if (letters.has(lower)) return lower;
  const stripped = stripDiacritics(lower);
  return letters.has(stripped) ? stripped : lower;
}

export function buildLetterStates(
  guesses: GuessRow[],
  letters: ReadonlySet<string>,
): Record<string, LetterFeedback> {
  const priority: Record<LetterFeedback, number> = {
    correct: 3,
    present: 2,
    absent: 1,
  };
  const state: Record<string, LetterFeedback> = {};
  for (const { guess, feedback } of guesses) {
    for (let index = 0; index < guess.length; index++) {
      const key = normalizeKey(guess[index], letters);
      const current = state[key];
      if (!current || priority[feedback[index]] > priority[current]) {
        state[key] = feedback[index];
      }
    }
  }
  return state;
}
