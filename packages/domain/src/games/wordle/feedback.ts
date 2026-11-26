import type { LetterFeedback } from '@marquinhos/contracts/wordle';

/**
 * Score an already normalized guess against the answer without mutating either input.
 * Exact matches consume letters before misplaced matches, and each answer letter
 * can be consumed once. The caller validates the guess and keeps the answer private.
 * Invalid guesses are not rejected here.
 *
 * @example
 * `computeFeedback('arara', 'carta')` returns
 * `['present', 'present', 'absent', 'absent', 'correct']`.
 */
export function computeFeedback(guess: string, word: string): LetterFeedback[] {
  const result: LetterFeedback[] = new Array(guess.length).fill('absent');
  const wordChars = word.split('');
  const guessChars = guess.split('');

  for (let i = 0; i < guessChars.length; i++) {
    if (guessChars[i] === wordChars[i]) {
      result[i] = 'correct';
      wordChars[i] = '\0';
      guessChars[i] = '\0';
    }
  }

  for (let i = 0; i < guessChars.length; i++) {
    const gc = guessChars[i];
    if (gc === undefined || gc === '\0') continue;
    const idx = wordChars.indexOf(gc);
    if (idx !== -1) {
      result[i] = 'present';
      wordChars[idx] = '\0';
    }
  }

  return result;
}
