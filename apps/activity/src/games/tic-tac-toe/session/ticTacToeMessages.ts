import type {
  Player,
  TicTacToeServerMessage,
  TicTacToeState,
} from '@marquinhos/contracts/activity/games/ticTacToe';
import { ACTION_REJECTED } from '@marquinhos/contracts/activity/protocol';

export interface TicTacToeView {
  player: Player | null;
  state: TicTacToeState;
  error: string;
}

export const initialTicTacToeView: TicTacToeView = {
  player: 'X',
  state: {
    board: [
      [null, null, null],
      [null, null, null],
      [null, null, null],
    ],
    currentPlayer: 'X',
    winner: null,
    isDraw: false,
    moveCount: 0,
  },
  error: '',
};

export function applyTicTacToeMessage(
  view: TicTacToeView,
  message: TicTacToeServerMessage,
): TicTacToeView {
  switch (message.type) {
    case 'init':
      return {
        ...view,
        player: message.payload.player,
        state: message.payload.state,
      };
    case 'state_update':
      return { ...view, state: message.payload };
    case 'game_ready':
      return { ...view, state: message.payload.state };
    case ACTION_REJECTED:
      return { ...view, error: message.payload.error };
    case 'opponent_disconnected':
    case 'opponent_reconnected':
    case 'restart_status':
      return view;
  }
}
