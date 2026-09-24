import type {
  CellValue,
  Player,
} from '@marquinhos/contracts/activity/games/ticTacToe';
import {
  opponentOf,
  winnerOf,
} from '@marquinhos/domain/games/tic-tac-toe/rules';

// Full minimax over a 3x3 board (max 9! states, trivial to search exactly)
// — this bot never loses, which is the correct behavior for the perfectly
// solved game rather than a cosmetic difficulty knob.
function minimax(cells: CellValue[], turn: Player, bot: Player): number {
  const winner = winnerOf(cells);
  if (winner) return winner === bot ? 1 : -1;
  if (cells.every((c) => c !== null)) return 0;

  const scores: number[] = [];
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] !== null) continue;
    const next = [...cells];
    next[i] = turn;
    scores.push(minimax(next, opponentOf(turn), bot));
  }

  return turn === bot ? Math.max(...scores) : Math.min(...scores);
}

export class TicTacToeBot {
  constructor(readonly side: Player) {}

  chooseMove(board: CellValue[][]): { row: number; col: number } | null {
    const cells = board.flat();
    let bestScore = -Infinity;
    let bestIndex = -1;

    for (let i = 0; i < cells.length; i++) {
      if (cells[i] !== null) continue;
      const next = [...cells];
      next[i] = this.side;
      const score = minimax(next, opponentOf(this.side), this.side);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    if (bestIndex === -1) return null;
    return { row: Math.floor(bestIndex / 3), col: bestIndex % 3 };
  }
}
