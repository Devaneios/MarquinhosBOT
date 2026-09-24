import type {
  Player,
  TicTacToeState,
} from '@marquinhos/contracts/activity/games/ticTacToe';
import {
  emptyBoard,
  opponentOf,
  placeMark,
} from '@marquinhos/domain/games/tic-tac-toe/rules';

interface MoveResult {
  success: boolean;
  error?: string;
}

export class TicTacToeEngine {
  private state: TicTacToeState;

  constructor() {
    this.state = this.initState();
  }

  private initState(): TicTacToeState {
    return {
      board: emptyBoard(),
      currentPlayer: 'X',
      winner: null,
      isDraw: false,
      moveCount: 0,
    };
  }

  getState(): Readonly<TicTacToeState> {
    return {
      board: this.state.board.map((row) => [...row]),
      currentPlayer: this.state.currentPlayer,
      winner: this.state.winner,
      isDraw: this.state.isDraw,
      moveCount: this.state.moveCount,
    };
  }

  makeMove(row: number, col: number, player: Player): MoveResult {
    if (this.state.winner || this.state.isDraw) {
      return { success: false, error: 'Game is already over' };
    }

    const placed = placeMark(this.state.board, row, col, player);
    if (!placed.ok) return { success: false, error: placed.error };

    if (player !== this.state.currentPlayer) {
      return {
        success: false,
        error: `It's not ${player}'s turn, it's ${this.state.currentPlayer}`,
      };
    }

    this.state.board = placed.board;
    this.state.moveCount += 1;
    this.state.winner = placed.winner;
    this.state.isDraw = placed.isDraw;
    if (!placed.winner && !placed.isDraw) {
      this.state.currentPlayer = opponentOf(player);
    }
    return { success: true };
  }

  reset(): void {
    this.state = this.initState();
  }
}
