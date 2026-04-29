import type { LetterFeedback } from './letter-states';
import type { TermoGuess } from './types';

const FEEDBACK_EMOJI: Record<LetterFeedback, string> = {
  correct: '🟩',
  present: '🟨',
  absent: '⬛',
};

export function formatGuessesAsText(guesses: TermoGuess[]): string {
  if (guesses.length === 0) return '';
  return guesses
    .map(({ guess, feedback }) => {
      const emojis = feedback.map((state) => FEEDBACK_EMOJI[state]).join('');
      return `${guess.toUpperCase()}: ${emojis}`;
    })
    .join('\n');
}
