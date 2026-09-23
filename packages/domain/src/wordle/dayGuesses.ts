import { z } from 'zod';
import { stripDiacritics, type LetterFeedback } from './feedback';

const letterFeedbackSchema = z.enum(['correct', 'present', 'absent']);
const storedGuessSchema = z.object({
  guess: z.string(),
  feedback: z.array(letterFeedbackSchema),
});

export interface WordleSessionGuessesRow {
  guesses: string;
}

function normalizeGuess(s: string): string {
  return stripDiacritics(s.trim().toLowerCase());
}

export function buildUniqueDayGuesses(
  answerWord: string,
  rows: WordleSessionGuessesRow[],
): { guess: string; feedback: LetterFeedback[] }[] {
  const answerKey = normalizeGuess(answerWord);
  const wordLength = answerWord.length;
  const seen = new Set<string>();
  const result: { guess: string; feedback: LetterFeedback[] }[] = [];

  for (const row of rows) {
    let guesses: unknown;
    try {
      guesses = JSON.parse(row.guesses);
    } catch {
      continue;
    }

    if (!Array.isArray(guesses)) continue;

    for (const entry of guesses) {
      const parsed = storedGuessSchema.safeParse(entry);
      if (!parsed.success) continue;
      const guess = parsed.data;
      if (guess.feedback.length !== wordLength) continue;

      const key = normalizeGuess(guess.guess);
      if (!key || key === answerKey || seen.has(key)) continue;

      seen.add(key);
      result.push({
        guess: guess.guess,
        feedback: guess.feedback,
      });
    }
  }

  return result;
}

