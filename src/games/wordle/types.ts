import type { MutableRefObject } from 'react';
import type { WsSession } from '../shared/activitySession';

export type LetterFeedback = 'correct' | 'present' | 'absent';
export type KeyState = LetterFeedback | 'unused';

export interface GuessRow {
  guess: string;
  feedback: LetterFeedback[];
}

export type WordleSessionState =
  | { status: 'connecting' }
  | { status: 'ready'; session: WsSession }
  | { status: 'error'; error: string };

export interface WordleInitPayload {
  wordLength: number;
  guesses: GuessRow[];
  solved: boolean;
}

export interface WordleGuessResultPayload {
  guesses: GuessRow[];
  solved: boolean;
}

export interface WordleGuessErrorPayload {
  message: string;
}

export interface CurrentRowProps {
  letters: string[];
  activeIndex: number;
  wordLength: number;
  shake: boolean;
  disabled: boolean;
  inputRefs: MutableRefObject<(HTMLInputElement | null)[]>;
  onFocusCell: (index: number) => void;
  onKeyDownCell: (
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => void;
}
