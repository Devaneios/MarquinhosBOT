import type {
  BoardSnapshot,
  MinesweeperServerMessage,
} from '@marquinhos/contracts/activity/games/minesweeperVersus';
import { applyRevealToBoard } from '../reveal';

export interface MinesweeperView {
  board: BoardSnapshot | null;
  errorMsg: string | null;
}

export const initialMinesweeperView: MinesweeperView = {
  board: null,
  errorMsg: null,
};

export function applyMinesweeperMessage(
  view: MinesweeperView,
  message: MinesweeperServerMessage,
): MinesweeperView {
  switch (message.type) {
    case 'init':
      return { board: message.payload, errorMsg: null };
    case 'reveal':
      return view.board
        ? { ...view, board: applyRevealToBoard(view.board, message.payload) }
        : view;
    case 'game_over':
      return view.board
        ? {
            ...view,
            board: {
              ...view.board,
              scores: message.payload.scores,
              gameOver: true,
            },
          }
        : view;
    case 'reveal_error':
      return { ...view, errorMsg: message.payload.message };
  }
}
