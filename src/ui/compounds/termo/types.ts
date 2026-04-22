import type { LetterFeedback } from './letter-states';

export type TermoGuess = {
  guess: string;
  feedback: LetterFeedback[];
};

export type TermoSolvedStatus = {
  attempts: number;
};
