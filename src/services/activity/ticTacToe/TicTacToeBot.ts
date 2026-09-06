import type {
  CellValue,
  Player,
} from 'services/activity/ticTacToe/TicTacToeEngine';

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

function flatten(board: CellValue[][]): CellValue[] {
  return board.flat();
}

function winnerOf(cells: CellValue[]): Player | null {
  for (const [a, b, c] of LINES) {
    if (cells[a] && cells[a] === cells[b] && cells[b] === cells[c]) {
      return cells[a];
    }
  }
  return null;
}

function opponentOf(player: Player): Player {
  return player === 'X' ? 'O' : 'X';
}

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
    const cells = flatten(board);
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
