import { Column, Row, Style, Text } from '@meonode/canvas';
import {
  attemptRow,
  buildLetterStates,
  keyboardRow,
  resultTile,
  TERMO_KB_ROWS,
  type LetterFeedback,
} from '../compounds/termo';
import { card, panel, sectionHeader, statCard } from '../primitives';
import { render } from '../render';
import { defaultTheme, type Theme } from '../theme';

export { type LetterFeedback };

type Guess = { guess: string; feedback: LetterFeedback[] };

export async function buildKeyboardImage(
  guesses: Guess[],
  wordLength: number,
  options?: { streak?: number; maxAttempts?: number; theme?: Theme },
): Promise<Buffer> {
  const theme = options?.theme ?? defaultTheme;
  const maxAttempts = options?.maxAttempts ?? 6;
  const streak = options?.streak;
  const halfRows = Math.ceil(maxAttempts / 2);
  const letterState = buildLetterStates(guesses);

  return render([
    card(
      [
        sectionHeader(
          'TENTATIVAS',
          streak !== undefined ? `STREAK: ${streak}` : undefined,
          theme,
        ),
        Row({
          width: '100%',
          justifyContent: Style.Justify.SpaceBetween,
          gap: 16,
          children: [
            Column({
              gap: 6,
              children: Array.from({ length: halfRows }, (_, i) =>
                attemptRow(guesses[i], wordLength, theme),
              ),
            }),
            Column({
              gap: 6,
              children: Array.from({ length: maxAttempts - halfRows }, (_, i) =>
                attemptRow(guesses[halfRows + i], wordLength, theme),
              ),
            }),
          ],
        }),
        panel(
          TERMO_KB_ROWS.map((row) => keyboardRow(row, letterState, theme)),
          { padding: 12, gap: 6 },
          theme,
        ),
      ],
      theme,
    ),
  ]);
}

export async function buildResultImage(
  guesses: Guess[],
  username: string,
  options?: { streak?: number; theme?: Theme },
): Promise<Buffer> {
  const theme = options?.theme ?? defaultTheme;
  const streak = options?.streak;
  const total = guesses.length;

  return render([
    card(
      [
        Column({
          width: '100%',
          alignItems: Style.Align.FlexStart,
          gap: 8,
          children: [
            Text(`${username} decifrou o Terminho de hoje.`, {
              fontFamily: theme.fontFamilies.body,
              fontWeight: '400',
              fontSize: theme.fontSizes.md,
              color: '#f1f1f1',
            }),
          ],
        }),
        Row({
          width: '100%',
          justifyContent: Style.Justify.Center,
          gap: 12,
          children: [
            statCard('TENTATIVAS', total, theme),
            ...(streak !== undefined
              ? [statCard('SEQUÊNCIA', streak, theme)]
              : []),
          ],
        }),
        panel(
          [
            sectionHeader('RESUMO', undefined, theme),
            Column({
              width: '100%',
              alignItems: Style.Align.Center,
              gap: 6,
              children: guesses.map((guess) =>
                Row({
                  justifyContent: Style.Justify.Center,
                  gap: 5,
                  children: guess.feedback.map((feedback) =>
                    resultTile(feedback, theme),
                  ),
                }),
              ),
            }),
          ],
          { padding: 12, gap: 10 },
          theme,
        ),
      ],
      theme,
    ),
  ]);
}
