export type TicTacToeSymbol = 'X' | 'O';
export type TicTacToeCell = TicTacToeSymbol | null;

export interface TicTacToeState {
  board: TicTacToeCell[][];
  currentPlayer: 0 | 1;
  gameOver: boolean;
  winnerIndex: 0 | 1 | null;
  isDraw: boolean;
  moves: number;
  timedOut: boolean;
}

export function createTicTacToeState(): TicTacToeState {
  return {
    board: [
      [null, null, null],
      [null, null, null],
      [null, null, null],
    ],
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
  if (
    state.gameOver ||
    !Number.isInteger(row) ||
    !Number.isInteger(col) ||
    row < 0 ||
    row > 2 ||
    col < 0 ||
    col > 2 ||
    state.board[row]?.[col] !== null
  ) {
    return state;
  }

  const board = state.board.map((line) => [...line]);
  const symbol = state.currentPlayer === 0 ? 'X' : 'O';
  board[row]![col] = symbol;
  const moves = state.moves + 1;
  const won = hasTicTacToeLine(board, symbol);

  if (won) {
    return { ...state, board, moves, gameOver: true, winnerIndex: state.currentPlayer };
  }

  if (moves === 9) {
    return { ...state, board, moves, gameOver: true, isDraw: true };
  }

  return {
    ...state,
    board,
    moves,
    currentPlayer: state.currentPlayer === 0 ? 1 : 0,
  };
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

export function getTicTacToeScores(
  state: TicTacToeState,
): [number, number] {
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

function hasTicTacToeLine(
  board: TicTacToeCell[][],
  symbol: TicTacToeSymbol,
): boolean {
  const lines = [
    ...board,
    [board[0]?.[0], board[1]?.[0], board[2]?.[0]],
    [board[0]?.[1], board[1]?.[1], board[2]?.[1]],
    [board[0]?.[2], board[1]?.[2], board[2]?.[2]],
    [board[0]?.[0], board[1]?.[1], board[2]?.[2]],
    [board[0]?.[2], board[1]?.[1], board[2]?.[0]],
  ];

  return lines.some((line) => line.every((cell) => cell === symbol));
}
