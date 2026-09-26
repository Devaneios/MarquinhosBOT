import type { WsSession } from '@/realtime/gameSession';
import type { LetterFeedback } from '@marquinhos/contracts/wordle';
import type { KeyboardEvent } from 'react';

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
  registerInput: (index: number, element: HTMLInputElement | null) => void;
  onFocusCell: (index: number) => void;
  onKeyDownCell: (
    index: number,
    event: KeyboardEvent<HTMLInputElement>,
  ) => void;
}
