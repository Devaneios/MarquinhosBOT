import type { GuessRow } from '@marquinhos/contracts/wordle';
import { buildLetterStates } from '@marquinhos/domain/wordle/keyboardState';
import { panel } from '../../primitives';
import { defaultTheme, type Theme } from '../../theme';
import type { CanvasNode } from '../../types';
import { TERMO_KB_LETTERS, TERMO_KB_ROWS } from './keyboard-layout';
import { keyboardRow } from './rows';

export function termoKeyboardPanel(
  guesses: GuessRow[],
  theme: Theme = defaultTheme,
): CanvasNode {
  const letterState = buildLetterStates(guesses, TERMO_KB_LETTERS);

  return panel(
    TERMO_KB_ROWS.map((row) => keyboardRow(row, letterState, theme)),
    { padding: 12, gap: 6 },
    theme,
  );
}
