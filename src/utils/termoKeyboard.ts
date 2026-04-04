import { Box, Column, Root, Row, Style, Text } from '@meonode/canvas';
import { fileURLToPath, URL } from 'url';

export type LetterFeedback = 'correct' | 'present' | 'absent';

const FONT_DIR = fileURLToPath(new URL('../resources/fonts', import.meta.url));

const KB_ROWS = ['qwertyuiop', 'asdfghjklç', 'zxcvbnm'];

const TILE_COLORS: Record<
  LetterFeedback | 'unused',
  { bg: string; text: string; side: string; highlight: string }
> = {
  correct: {
    bg: '#588157',
    text: '#E8E8E8',
    side: '#3d5c3b',
    highlight: '#6a9b68',
  },
  present: {
    bg: '#C0A054',
    text: '#1C1C1E',
    side: '#8a7340',
    highlight: '#d4b86a',
  },
  absent: {
    bg: '#3A3A3C',
    text: '#E8E8E8',
    side: '#2a2a2c',
    highlight: '#4a4a4e',
  },
  unused: {
    bg: '#818384',
    text: '#1C1C1E',
    side: '#5c5d5e',
    highlight: '#969798',
  },
};

export async function buildKeyboardImage(
  guesses: { guess: string; feedback: LetterFeedback[] }[],
  wordLength: number,
  options?: { streak?: number; maxAttempts?: number },
): Promise<Buffer> {
  const maxAttempts = options?.maxAttempts ?? 6;
  const streak = options?.streak;
  const halfRows = Math.ceil(maxAttempts / 2);

  const letterState: Record<string, LetterFeedback> = {};
  const priority: Record<LetterFeedback, number> = {
    correct: 3,
    present: 2,
    absent: 1,
  };

  for (const { guess, feedback } of guesses) {
    for (let i = 0; i < guess.length; i++) {
      const letter = guess[i];
      const current = letterState[letter];
      if (!current || priority[feedback[i]] > priority[current]) {
        letterState[letter] = feedback[i];
      }
    }
  }

  function buildAttemptRow(index: number) {
    const attempt = guesses[index];
    if (attempt) {
      return Row({
        justifyContent: Style.Justify.FlexStart,
        gap: 2,
        width: '100%',
        children: attempt.guess.split('').map((letter, i) => {
          const colors = TILE_COLORS[attempt.feedback[i]];
          return Box({
            width: 24,
            height: 24,
            backgroundColor: colors.bg,
            borderRadius: 2,
            justifyContent: Style.Justify.Center,
            alignItems: Style.Align.Center,
            children: [
              Text(letter.toUpperCase(), {
                fontFamily: 'Space Grotesk',
                fontWeight: 'bold',
                fontSize: 14,
                color: colors.text,
              }),
            ],
          });
        }),
      });
    }
    return Row({
      justifyContent: Style.Justify.SpaceBetween,
      width: '100%',
      opacity: 0.3,
      children: Array.from({ length: wordLength }, () =>
        Box({
          width: 24,
          height: 24,
          borderRadius: 2,
          border: 1,
          borderColor: 'rgba(65,73,62,0.2)',
        }),
      ),
    });
  }

  function buildKeyboardRow(row: string) {
    return Row({
      justifyContent: Style.Justify.Center,
      gap: 4,
      children: row.split('').map((letter) => {
        const colors = TILE_COLORS[letterState[letter] ?? 'unused'];
        return Box({
          width: 28,
          height: 32,
          backgroundColor: colors.side,
          borderRadius: 5,
          justifyContent: Style.Justify.FlexStart,
          alignItems: Style.Align.Center,
          boxShadow: {
            offsetX: 0,
            offsetY: 2,
            blur: 3,
            color: 'rgba(0, 0, 0, 0.4)',
          },
          children: [
            Box({
              width: 24,
              height: 28,
              gradient: {
                type: 'linear' as const,
                colors: [colors.highlight, colors.bg],
                direction: 'to-bottom' as const,
              },
              borderRadius: 4,
              justifyContent: Style.Justify.Center,
              alignItems: Style.Align.Center,
              boxShadow: [
                {
                  inset: true,
                  offsetX: 0,
                  offsetY: 1,
                  blur: 0,
                  color: 'rgba(255, 255, 255, 0.15)',
                },
                {
                  inset: true,
                  offsetX: 0,
                  offsetY: -1,
                  blur: 0,
                  color: 'rgba(0, 0, 0, 0.2)',
                },
              ],
              children: [
                Text(letter.toUpperCase(), {
                  fontFamily: 'Inter',
                  fontWeight: '600',
                  fontSize: 10,
                  color: colors.text,
                }),
              ],
            }),
          ],
        });
      }),
    });
  }

  const canvas = await Root({
    width: 360,
    scale: 2,
    fonts: [
      { family: 'Space Grotesk', paths: [`${FONT_DIR}/SpaceGrotesk.ttf`] },
      { family: 'Inter', paths: [`${FONT_DIR}/Inter.ttf`] },
    ],
    children: [
      Column({
        width: '100%',
        backgroundColor: '#121213',
        borderRadius: 12,
        boxShadow: { blur: 24, color: 'rgba(0,0,0,0.5)' },
        border: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        padding: 16,
        gap: 16,
        children: [
          Column({
            width: '100%',
            children: [
              Row({
                width: '100%',
                justifyContent: Style.Justify.SpaceBetween,
                alignItems: Style.Align.FlexEnd,
                children: [
                  Text('TENTATIVAS', {
                    fontFamily: 'Space Grotesk',
                    fontWeight: 'bold',
                    fontSize: 18,
                    color: '#E8E8E8',
                  }),
                  ...(streak !== undefined
                    ? [
                        Text(`STREAK: ${streak}`, {
                          fontFamily: 'Inter',
                          fontWeight: '500',
                          fontSize: 12,
                          color: '#98d68f',
                          letterSpacing: 2,
                        }),
                      ]
                    : []),
                ],
              }),
              Box({
                width: '100%',
                height: 1,
                backgroundColor: '#353436',
                marginTop: 8,
              }),
            ],
          }),
          Row({
            width: '100%',
            justifyContent: Style.Justify.SpaceBetween,
            gap: 16,
            children: [
              Column({
                gap: 6,
                children: Array.from({ length: halfRows }, (_, i) =>
                  buildAttemptRow(i),
                ),
              }),
              Column({
                gap: 6,
                children: Array.from(
                  { length: maxAttempts - halfRows },
                  (_, i) => buildAttemptRow(halfRows + i),
                ),
              }),
            ],
          }),
          Column({
            width: '100%',
            backgroundColor: '#0e0e0f',
            borderRadius: 12,
            padding: 12,
            gap: 6,
            children: KB_ROWS.map(buildKeyboardRow),
          }),
        ],
      }),
    ],
  });

  const buffer = Buffer.from(canvas.toBufferSync());
  canvas.release();
  return buffer;
}
