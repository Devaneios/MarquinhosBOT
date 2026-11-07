import { guessRowSchema, type GuessRow } from '@marquinhos/contracts/wordle';
import { stripDiacritics } from '@marquinhos/domain/shared/text/stripDiacritics';

export interface WordleSessionGuessesRow {
  guesses: string;
}

function normalizeGuess(s: string): string {
  return stripDiacritics(s.trim().toLowerCase());
}

export function buildUniqueDayGuesses(
  answerWord: string,
  rows: WordleSessionGuessesRow[],
): GuessRow[] {
  const answerKey = normalizeGuess(answerWord);
  const wordLength = answerWord.length;
  const seen = new Set<string>();
  const result: GuessRow[] = [];

  for (const row of rows) {
    let guesses: unknown;
    try {
      guesses = JSON.parse(row.guesses);
    } catch {
      continue;
    }

    if (!Array.isArray(guesses)) continue;

    for (const entry of guesses) {
      const parsed = guessRowSchema.safeParse(entry);
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
