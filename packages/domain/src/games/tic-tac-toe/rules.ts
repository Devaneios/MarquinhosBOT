import type {
  CellValue,
  Player,
} from '@marquinhos/contracts/activity/games/ticTacToe';

const SIZE = 3;

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

export type PlaceResult =
  | {
      ok: true;
      board: CellValue[][];
      winner: Player | null;
      isDraw: boolean;
    }
  | { ok: false; error: string };

export function emptyBoard(): CellValue[][] {
  return Array.from({ length: SIZE }, () => Array<CellValue>(SIZE).fill(null));
}

export function opponentOf(player: Player): Player {
  return player === 'X' ? 'O' : 'X';
}

export function winnerOf(cells: readonly CellValue[]): Player | null {
  for (const [a, b, c] of LINES) {
    const mark = cells[a];
    if (mark && mark === cells[b] && mark === cells[c]) return mark;
  }
  return null;
}

export function placeMark(
  board: readonly (readonly CellValue[])[],
  row: number,
  col: number,
  mark: Player,
): PlaceResult {
  if (
    !Number.isInteger(row) ||
    !Number.isInteger(col) ||
    row < 0 ||
    row >= SIZE ||
    col < 0 ||
    col >= SIZE
  ) {
    return { ok: false, error: 'Invalid coordinates' };
  }
  if (board[row]![col] !== null) {
    return { ok: false, error: 'Cell is occupied' };
  }
  const next = board.map((line) => [...line]);
  next[row]![col] = mark;
  const cells = next.flat();
  const winner = winnerOf(cells);
  return {
    ok: true,
    board: next,
    winner,
    isDraw: winner === null && cells.every((cell) => cell !== null),
  };
}
