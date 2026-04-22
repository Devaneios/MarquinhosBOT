import { Row, Style } from '@meonode/canvas';
import { defaultTheme, type Theme } from '../../theme';
import type { CanvasNode } from '../../types';
import { keyboardKey } from './keyboard-key';
import type { LetterFeedback } from './letter-states';
import { attemptTile, emptyTile } from './tiles';

export function attemptRow(
  attempt: { guess: string; feedback: LetterFeedback[] } | undefined,
  wordLength: number,
  theme: Theme = defaultTheme,
): CanvasNode {
  if (attempt) {
    return Row({
      justifyContent: Style.Justify.FlexStart,
      gap: 2,
      width: '100%',
      children: attempt.guess
        .split('')
        .map((letter, i) => attemptTile(attempt.feedback[i], letter, theme)),
    });
  }
  return Row({
    justifyContent: Style.Justify.SpaceBetween,
    width: '100%',
    opacity: 0.3,
    children: Array.from({ length: wordLength }, () => emptyTile(theme)),
  });
}

export function keyboardRow(
  row: string,
  letterStates: Record<string, LetterFeedback>,
  theme: Theme = defaultTheme,
): CanvasNode {
  return Row({
    justifyContent: Style.Justify.Center,
    gap: 4,
    children: row
      .split('')
      .map((letter) =>
        keyboardKey(letter, letterStates[letter] ?? 'unused', theme),
      ),
  });
}
