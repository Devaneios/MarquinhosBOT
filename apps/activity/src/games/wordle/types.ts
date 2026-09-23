import type { KeyboardEvent, RefObject } from 'react';
import { z } from 'zod';
import type { WsSession } from '../shared/activitySession';

const letterFeedbackSchema = z.enum(['correct', 'present', 'absent']);
export type LetterFeedback = z.infer<typeof letterFeedbackSchema>;
export type KeyState = LetterFeedback | 'unused';

interface WordleUserConfigBase {
  invertActionKeys: boolean;
  enableSounds: boolean;
}

export type WordleUserConfig = WordleUserConfigBase &
  (
    | { enableSpaceKey: false; enableArrowKeys: false }
    | { enableSpaceKey: true; enableArrowKeys: boolean }
  );

const guessRowSchema = z.object({
  guess: z.string(),
  feedback: z.array(letterFeedbackSchema),
});

export type GuessRow = z.infer<typeof guessRowSchema>;

export type WordleSessionState =
  | { status: 'connecting' }
  | { status: 'ready'; session: WsSession }
  | { status: 'error'; error: string };

export const wordleInitPayloadSchema = z.object({
  wordLength: z.number(),
  guesses: z.array(guessRowSchema),
  solved: z.boolean(),
});

export const wordleGuessResultPayloadSchema = z.object({
  guesses: z.array(guessRowSchema),
  solved: z.boolean(),
});

export const wordleGuessErrorPayloadSchema = z.object({ message: z.string() });

export interface CurrentRowProps {
  letters: string[];
  activeIndex: number;
  wordLength: number;
  shake: boolean;
  disabled: boolean;
  inputRefs: RefObject<(HTMLInputElement | null)[]>;
  onFocusCell: (index: number) => void;
  onKeyDownCell: (
    index: number,
    event: KeyboardEvent<HTMLInputElement>,
  ) => void;
}
