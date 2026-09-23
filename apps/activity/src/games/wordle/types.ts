import {
  guessRowSchema,
  type LetterFeedback,
} from '@marquinhos/contracts/wordle';
import type { KeyboardEvent, RefObject } from 'react';
import { z } from 'zod';
import type { WsSession } from '../shared/activitySession';

export type KeyState = LetterFeedback | 'unused';

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
