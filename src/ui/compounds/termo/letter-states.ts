export type LetterFeedback = 'correct' | 'present' | 'absent';

const KB_ROWS = ['qwertyuiop', 'asdfghjklç', 'zxcvbnm'];
const KB_LETTERS = new Set(KB_ROWS.join(''));

function letterToKey(ch: string): string {
  if (KB_LETTERS.has(ch)) return ch;
  const stripped = ch.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  return KB_LETTERS.has(stripped) ? stripped : ch;
}

export function buildLetterStates(
  guesses: { guess: string; feedback: LetterFeedback[] }[],
): Record<string, LetterFeedback> {
  const letterState: Record<string, LetterFeedback> = {};
  const priority: Record<LetterFeedback, number> = {
    correct: 3,
    present: 2,
    absent: 1,
  };
  for (const { guess, feedback } of guesses) {
    for (let i = 0; i < guess.length; i++) {
      const key = letterToKey(guess[i]);
      const current = letterState[key];
      if (!current || priority[feedback[i]] > priority[current]) {
        letterState[key] = feedback[i];
      }
    }
  }
  return letterState;
}

export const TERMO_KB_ROWS = KB_ROWS;
