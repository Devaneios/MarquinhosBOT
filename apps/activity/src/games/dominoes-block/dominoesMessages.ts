import type {
  DominoesClientState,
  DominoesServerMessage,
} from '@marquinhos/contracts/activity/games/dominoesBlock';

export interface DominoesView {
  state: DominoesClientState | null;
  rejection: string | null;
  restartStatus: { votes: number; required: number } | null;
  restartRequested: boolean;
  disconnectedOpponent: { userId: string; timeoutMs: number } | null;
}

export const initialDominoesView: DominoesView = {
  state: null,
  rejection: null,
  restartStatus: null,
  restartRequested: false,
  disconnectedOpponent: null,
};

export function isMatchOver(state: DominoesClientState | null): boolean {
  return Boolean(state && (state.winner || state.blocked));
}

export function applyDominoesMessage(
  view: DominoesView,
  message: DominoesServerMessage,
): DominoesView {
  switch (message.type) {
    case 'state': {
      const next = { ...view, state: message.payload, rejection: null };
      if (isMatchOver(message.payload)) return next;
      return { ...next, restartStatus: null, restartRequested: false };
    }
    case 'move_rejected':
      return { ...view, rejection: message.payload.reason };
    case 'restart_status':
      return { ...view, restartStatus: message.payload };
    case 'opponent_disconnected':
      return { ...view, disconnectedOpponent: message.payload };
    case 'opponent_reconnected':
      return { ...view, disconnectedOpponent: null };
    case 'match_over':
      return view;
  }
}
