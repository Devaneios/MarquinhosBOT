import type {
  CheckersServerMessage,
  CheckersState,
  Color,
} from '@marquinhos/contracts/activity/games/checkers';
import { ACTION_REJECTED } from '@marquinhos/contracts/activity/protocol';

export interface CheckersView {
  myColor: Color | null;
  state: CheckersState | null;
  notice: 'moveRejected' | 'opponentDisconnected' | null;
  clearSelectionSignal: number;
}

export const initialCheckersView: CheckersView = {
  myColor: null,
  state: null,
  notice: null,
  clearSelectionSignal: 0,
};

export function applyCheckersMessage(
  view: CheckersView,
  message: CheckersServerMessage,
): CheckersView {
  switch (message.type) {
    case 'init':
      return {
        ...view,
        myColor: message.payload.color,
        state: message.payload.state,
      };
    case 'state':
      return { ...view, state: message.payload };
    case ACTION_REJECTED:
      return {
        ...view,
        notice: 'moveRejected',
        clearSelectionSignal: view.clearSelectionSignal + 1,
      };
    case 'opponent_disconnected':
      return { ...view, notice: 'opponentDisconnected' };
    case 'opponent_reconnected':
      return { ...view, notice: null };
    case 'restart_status':
      return view;
  }
}
