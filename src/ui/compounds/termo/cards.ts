import { card, sectionHeader } from '../../primitives';
import { defaultTheme, type Theme } from '../../theme';
import type { CanvasNode } from '../../types';
import { attemptGrid } from './attempt-grid';
import { termoKeyboardPanel } from './keyboard-panel';
import { resultIntro, resultStats, resultSummaryPanel } from './result-summary';
import { statsLead, termoStatsPanel, type TermoStats } from './stats';
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
  const streak = options?.streak;

  return card(
    [
      sectionHeader(
        'TENTATIVAS',
        streak !== undefined ? `STREAK: ${streak}` : undefined,
        theme,
      ),
      ...(options?.status !== undefined
        ? [solvedStatusBanner(options.status, theme)]
        : []),
      attemptGrid(guesses, wordLength, maxAttempts, theme),
      termoKeyboardPanel(guesses, theme),
    ],
    theme,
  );
}

export function termoResultCard(
  guesses: TermoGuess[],
  username: string,
  options?: { streak?: number },
  theme: Theme = defaultTheme,
): CanvasNode {
  return card(
    [
      resultIntro(username, theme),
      resultStats(guesses.length, options?.streak, theme),
      resultSummaryPanel(guesses, theme),
    ],
    theme,
  );
}

export function termoStatsCard(
  stats: TermoStats,
  options?: { title?: string; subtitle?: string; revealWord?: boolean },
  theme: Theme = defaultTheme,
): CanvasNode {
  return card(
    [
      statsLead(options?.title ?? 'STATUS DO TERMO', options?.subtitle, theme),
      termoStatsPanel(
        stats,
        { title: 'ESTATISTICAS', revealWord: options?.revealWord },
        theme,
      ),
    ],
    theme,
  );
}
