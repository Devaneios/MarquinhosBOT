import type { LetterFeedback } from '@marquinhos/contracts/wordle';
import type { KeyboardEvent, RefObject } from 'react';
import type { WsSession } from '../shared/activitySession';

export type KeyState = LetterFeedback | 'unused';

export type WordleSessionState =
  | { status: 'connecting' }
  | { status: 'ready'; session: WsSession }
  | { status: 'error'; error: string };

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
