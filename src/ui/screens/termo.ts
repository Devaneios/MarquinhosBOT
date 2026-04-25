import {
  buildCrosswordLayout,
  termoCrosswordCard,
  termoKeyboardCard,
  termoResultCard,
  wordPreviewCard,
  type LetterFeedback,
  type TermoGuess,
  type TermoSolvedStatus,
} from '../compounds/termo';
import { render } from '../render';
import { defaultTheme, type Theme } from '../theme';

export { type LetterFeedback, type TermoSolvedStatus };

export async function buildKeyboardImage(
  guesses: TermoGuess[],
  wordLength: number,
  options?: {
    streak?: number;
    maxAttempts?: number;
    status?: TermoSolvedStatus;
    theme?: Theme;
  },
): Promise<Buffer> {
  const theme = options?.theme ?? defaultTheme;
  return render([termoKeyboardCard(guesses, wordLength, options, theme)]);
}

export async function buildResultImage(
  guesses: TermoGuess[],
  options?: { theme?: Theme },
): Promise<Buffer> {
  const theme = options?.theme ?? defaultTheme;
  return render([termoResultCard(guesses, theme)], {
    width: (32 + 4) * guesses[0].feedback.length + 24,
  });
}

export async function buildWordPreviewImage(
  word: string,
  options?: { theme?: Theme },
): Promise<Buffer> {
  const theme = options?.theme ?? defaultTheme;
  return render([wordPreviewCard(word, theme)], {
    width: (32 + 4) * word.length + 24,
  });
}

export async function buildCrosswordImage(
  guesses: TermoGuess[],
  answerWord: string,
  options?: { theme?: Theme },
): Promise<Buffer> {
  const theme = options?.theme ?? defaultTheme;
  const layout = buildCrosswordLayout(answerWord, guesses);
  const cols = layout.maxCol - layout.minCol + 1;
  const width = cols * 32 + (cols - 1) * 4 + 24;
  return render([termoCrosswordCard(layout, theme)], { width });
}

export async function buildWordHiddenPreviewImage(
  wordLength: number,
  options?: { theme?: Theme },
): Promise<Buffer> {
  const theme = options?.theme ?? defaultTheme;
  return render([wordPreviewCard(' '.repeat(wordLength), theme)], {
    width: (32 + 4) * wordLength + 24,
  });
}
