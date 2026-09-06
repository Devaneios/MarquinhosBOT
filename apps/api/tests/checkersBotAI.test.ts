import { describe, expect, it } from 'bun:test';
import { chooseCheckersMove } from 'services/activity/checkers/CheckersBotAI';
import {
  CheckersEngine,
  type Piece,
} from 'services/activity/checkers/CheckersEngine';

function emptyBoard() {
  return Array.from({ length: 8 }, () => Array<Piece | null>(8).fill(null));
}

describe('chooseCheckersMove', () => {
  it('prefers a capture over a quiet move when both are on the table', () => {
    const engine = new CheckersEngine();
    (engine as any).board = emptyBoard();
    (engine as any).board[2][1] = { color: 'black', king: false };
    (engine as any).board[3][2] = { color: 'red', king: false };
    (engine as any).turn = 'black';

    const move = chooseCheckersMove(engine, 'black');
    expect(move).not.toBeNull();
    expect(move!.captures.length).toBe(1);
  });

  it('prefers the longer capture chain when multiple jumps are available', () => {
    const engine = new CheckersEngine();
    (engine as any).board = emptyBoard();
    (engine as any).board[2][1] = { color: 'black', king: false };
    (engine as any).board[3][2] = { color: 'red', king: false };
    (engine as any).board[5][4] = { color: 'red', king: false };
    (engine as any).board[2][5] = { color: 'black', king: false };
    (engine as any).board[3][4] = { color: 'red', king: false };
    (engine as any).turn = 'black';

    const move = chooseCheckersMove(engine, 'black');
    expect(move).toEqual({
      from: { row: 2, col: 1 },
      to: { row: 4, col: 3 },
      captures: [{ row: 3, col: 2 }],
    });
  });

  it('returns null when the color to move has no legal moves', () => {
    const engine = new CheckersEngine();
    (engine as any).board = emptyBoard();
    (engine as any).board[0][1] = { color: 'red', king: false };
    (engine as any).board[1][0] = { color: 'black', king: false };
    (engine as any).turn = 'red';

    const move = chooseCheckersMove(engine, 'red');
    expect(move).toBeNull();
  });

  it('picks a legal quiet move when no captures are available', () => {
    const engine = new CheckersEngine();
    const move = chooseCheckersMove(engine, 'black');
    expect(move).not.toBeNull();
    const legal = engine.getLegalMoves('black');
    expect(
      legal.some(
        (m) =>
          m.from.row === move!.from.row &&
          m.from.col === move!.from.col &&
          m.to.row === move!.to.row &&
          m.to.col === move!.to.col,
      ),
    ).toBe(true);
  });
});
