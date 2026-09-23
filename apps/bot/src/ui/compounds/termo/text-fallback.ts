import type { GuessRow, LetterFeedback } from '@marquinhos/contracts/wordle';

const FEEDBACK_EMOJI: Record<LetterFeedback, string> = {
  correct: '🟩',
  present: '🟨',
  absent: '⬛',
};

export function formatGuessesAsText(guesses: GuessRow[]): string {
  if (guesses.length === 0) return '';
  return guesses
    .map(({ guess, feedback }) => {
      const emojis = feedback.map((state) => FEEDBACK_EMOJI[state]).join('');
      return `${guess.toUpperCase()}: ${emojis}`;
    })
    .join('\n');
}
