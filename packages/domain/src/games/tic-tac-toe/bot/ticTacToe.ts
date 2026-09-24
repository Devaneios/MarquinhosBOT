import type { CellValue } from '@marquinhos/contracts/activity/games/ticTacToe';
import {
  emptyBoard,
  placeMark,
} from '@marquinhos/domain/games/tic-tac-toe/rules';

export interface TicTacToeState {
  board: CellValue[][];
  currentPlayer: 0 | 1;
  gameOver: boolean;
  winnerIndex: 0 | 1 | null;
  isDraw: boolean;
  moves: number;
  timedOut: boolean;
}

export function createTicTacToeState(): TicTacToeState {
  return {
    board: emptyBoard(),
    currentPlayer: 0,
    gameOver: false,
    winnerIndex: null,
    isDraw: false,
    moves: 0,
    timedOut: false,
  };
}

export function applyTicTacToeMove(
  state: TicTacToeState,
  row: number,
  col: number,
): TicTacToeState {
  if (state.gameOver) return state;
  const placed = placeMark(
    state.board,
    row,
    col,
    state.currentPlayer === 0 ? 'X' : 'O',
  );
  if (!placed.ok) return state;

  const next = { ...state, board: placed.board, moves: state.moves + 1 };
  if (placed.winner) {
    return { ...next, gameOver: true, winnerIndex: state.currentPlayer };
  }
  if (placed.isDraw) return { ...next, gameOver: true, isDraw: true };
  return { ...next, currentPlayer: state.currentPlayer === 0 ? 1 : 0 };
}

export function forfeitTicTacToeTurn(
  state: TicTacToeState,
  losingPlayer: 0 | 1,
): TicTacToeState {
  if (state.gameOver || state.currentPlayer !== losingPlayer) return state;

  return {
    ...state,
    gameOver: true,
    timedOut: true,
    winnerIndex: losingPlayer === 0 ? 1 : 0,
  };
}

export function getTicTacToeScores(state: TicTacToeState): [number, number] {
  if (state.winnerIndex !== null) {
    return state.winnerIndex === 0 ? [100, 20] : [20, 100];
  }
  if (state.isDraw) return [50, 50];
  return [0, 0];
}

export function getTicTacToeRewardBonuses(
  state: TicTacToeState,
): [number, number] {
  if (state.winnerIndex !== null) {
    return state.winnerIndex === 0 ? [20, 0] : [0, 20];
  }
  if (state.isDraw) return [10, 10];
  return [0, 0];
}
