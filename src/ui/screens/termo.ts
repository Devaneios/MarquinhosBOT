import {
  newWordCard,
  termoKeyboardCard,
  termoNoticeCard,
  termoResultCard,
  termoStatsCard,
  type LetterFeedback,
  type TermoGuess,
  type TermoNewWord,
  type TermoSolvedStatus,
  type TermoStats,
} from '../compounds/termo';
import { render } from '../render';
import { defaultTheme, type Theme } from '../theme';

export {
  type LetterFeedback,
  type TermoNewWord,
  type TermoSolvedStatus,
  type TermoStats,
};

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
  username: string,
  options?: { streak?: number; theme?: Theme },
): Promise<Buffer> {
  const theme = options?.theme ?? defaultTheme;

  return render([termoResultCard(guesses, username, options, theme)]);
}

export async function buildNewWordImage(
  data: TermoNewWord,
  options?: { revealWord?: boolean; admin?: boolean; theme?: Theme },
): Promise<Buffer> {
  const theme = options?.theme ?? defaultTheme;

  return render([newWordCard(data, options, theme)]);
}

export async function buildStatsImage(
  stats: TermoStats,
  options?: {
    title?: string;
    subtitle?: string;
    revealWord?: boolean;
    theme?: Theme;
  },
): Promise<Buffer> {
  const theme = options?.theme ?? defaultTheme;

  return render([termoStatsCard(stats, options, theme)]);
}

export async function buildNoticeImage(
  title: string,
  body: string,
  options?: { badge?: string; theme?: Theme },
): Promise<Buffer> {
  const theme = options?.theme ?? defaultTheme;

  return render([termoNoticeCard(title, body, options, theme)]);
}
