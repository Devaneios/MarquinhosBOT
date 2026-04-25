import { card, panel } from '../../primitives';
import { defaultTheme, type Theme } from '../../theme';
import type { CanvasNode } from '../../types';
import { attemptGrid } from './attempt-grid';
import { termoKeyboardPanel } from './keyboard-panel';
import { resultSummaryPanel } from './result-summary';
import { wordPreview } from './stats';
import { solvedStatusBanner } from './status-banner';
import type { TermoGuess, TermoSolvedStatus } from './types';

export type TermoKeyboardCardOptions = {
  streak?: number;
  maxAttempts?: number;
  status?: TermoSolvedStatus;
};

export function termoKeyboardCard(
  guesses: TermoGuess[],
  wordLength: number,
  options?: TermoKeyboardCardOptions,
  theme: Theme = defaultTheme,
): CanvasNode {
  const maxAttempts = options?.maxAttempts ?? 6;

  return card(
    [
      ...(options?.status !== undefined
        ? [solvedStatusBanner(options.status, theme)]
        : []),
      panel(
        attemptGrid(guesses, wordLength, maxAttempts, theme),
        { padding: 12, gap: 6 },
        theme,
      ),
      termoKeyboardPanel(guesses, theme),
    ],
    theme,
  );
}

export function termoResultCard(
  guesses: TermoGuess[],
  theme: Theme = defaultTheme,
): CanvasNode {
  return card([resultSummaryPanel(guesses, theme)], theme);
}

export function wordPreviewCard(
  word: string,
  theme: Theme = defaultTheme,
): CanvasNode {
  return card([wordPreview(word, word.length, true, theme)], theme);
}

export function wordHiddenPreviewCard(
  wordLength: number,
  theme: Theme = defaultTheme,
): CanvasNode {
  return card(
    [wordPreview(' '.repeat(wordLength), wordLength, false, theme)],
    theme,
  );
}
