import { panel } from '../../primitives';
import { defaultTheme, type Theme } from '../../theme';
import type { CanvasNode } from '../../types';
import { buildLetterStates, TERMO_KB_ROWS } from './letter-states';
import { keyboardRow } from './rows';
import type { TermoGuess } from './types';

export function termoKeyboardPanel(
  guesses: TermoGuess[],
  theme: Theme = defaultTheme,
): CanvasNode {
  const letterState = buildLetterStates(guesses);

  return panel(
    TERMO_KB_ROWS.map((row) => keyboardRow(row, letterState, theme)),
    { padding: 12, gap: 6 },
    theme,
  );
}
