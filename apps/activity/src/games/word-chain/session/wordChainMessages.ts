import type {
  WordChainServerMessage,
  WordChainState,
} from '@marquinhos/contracts/activity/games/wordChain';
import { ACTION_REJECTED } from '@marquinhos/contracts/activity/protocol';

export interface WordChainView {
  state: WordChainState;
  error: string | null;
  pausedOpponent: { userId: string; timeoutMs: number } | null;
}

export const initialWordChainView: WordChainView = {
  state: {
    currentWord: '',
    currentTurn: '',
    usedWords: [],
    players: [],
    gameOver: false,
    winner: null,
  },
  error: null,
  pausedOpponent: null,
};

export function isServerReply(message: WordChainServerMessage): boolean {
  return (
    message.type === 'init' ||
    message.type === 'state' ||
    message.type === ACTION_REJECTED
  );
}

export function applyWordChainMessage(
  view: WordChainView,
  message: WordChainServerMessage,
): WordChainView {
  switch (message.type) {
    case 'init':
      return { ...view, state: message.payload, error: null };
    case 'state':
      return { ...view, state: message.payload };
    case ACTION_REJECTED:
      return { ...view, error: message.payload.error };
    case 'opponent_disconnected':
      return { ...view, pausedOpponent: message.payload };
    case 'opponent_reconnected':
      return { ...view, pausedOpponent: null };
  }
}
