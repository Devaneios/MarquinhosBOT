export type Player = 'X' | 'O';
export type CellValue = Player | null;

export interface TicTacToeState {
  board: CellValue[][];
  currentPlayer: Player;
  winner: Player | null;
  isDraw: boolean;
  moveCount: number;
}

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
      board: [
        [null, null, null],
        [null, null, null],
        [null, null, null],
      ],
      currentPlayer: 'X',
      winner: null,
      isDraw: false,
      moveCount: 0,
    };
  }

  getState(): Readonly<TicTacToeState> {
    return {
      board: this.state.board.map((row) => [...row]) as CellValue[][],
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

    if (row < 0 || row > 2 || col < 0 || col > 2) {
      return { success: false, error: 'Invalid coordinates' };
    }

    if (this.state.board[row]![col] !== null) {
      return { success: false, error: 'Cell is occupied' };
    }

    if (player !== this.state.currentPlayer) {
      return {
        success: false,
        error: `It's not ${player}'s turn, it's ${this.state.currentPlayer}`,
      };
    }

    this.state.board[row]![col] = player;
    this.state.moveCount += 1;

    if (this.checkWin(row, col, player)) {
      this.state.winner = player;
      return { success: true };
    }

    if (this.state.moveCount === 9) {
      this.state.isDraw = true;
      return { success: true };
    }

    this.state.currentPlayer = player === 'X' ? 'O' : 'X';
    return { success: true };
  }

  private checkWin(row: number, col: number, player: Player): boolean {
    return (
      this.checkRow(row, player) ||
      this.checkColumn(col, player) ||
      this.checkDiagonals(player)
    );
  }

  private checkRow(row: number, player: Player): boolean {
    return this.state.board[row]!.every((cell) => cell === player);
  }

  private checkColumn(col: number, player: Player): boolean {
    return this.state.board.every((row) => row[col]! === player);
  }

  private checkDiagonals(player: Player): boolean {
    const topLeftBottomRight =
      this.state.board[0]![0] === player &&
      this.state.board[1]![1] === player &&
      this.state.board[2]![2] === player;

    const topRightBottomLeft =
      this.state.board[0]![2] === player &&
      this.state.board[1]![1] === player &&
      this.state.board[2]![0] === player;

    return topLeftBottomRight || topRightBottomLeft;
  }

  reset(): void {
    this.state = this.initState();
  }
}
