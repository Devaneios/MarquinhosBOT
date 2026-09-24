import { describe, expect, it } from 'bun:test';
import { emptyBoard, placeMark, winnerOf } from './rules';

describe('tic-tac-toe rules', () => {
  it('places a mark on a copy of the board', () => {
    const board = emptyBoard();
    const placed = placeMark(board, 1, 2, 'O');

    expect(placed).toEqual({
      ok: true,
      board: [
        [null, null, null],
        [null, null, 'O'],
        [null, null, null],
      ],
      winner: null,
      isDraw: false,
    });
    expect(board[1]).toEqual([null, null, null]);
  });

  it('rejects out-of-range, fractional and occupied cells', () => {
    const board = emptyBoard();
    board[0]![0] = 'X';

    expect(placeMark(board, 3, 0, 'O')).toEqual({
      ok: false,
      error: 'Invalid coordinates',
    });
    expect(placeMark(board, 0.5, 0, 'O')).toEqual({
      ok: false,
      error: 'Invalid coordinates',
    });
    expect(placeMark(board, 0, 0, 'O')).toEqual({
      ok: false,
      error: 'Cell is occupied',
    });
  });

  it('detects every winning line', () => {
    for (const line of [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ]) {
      const cells = Array<'X' | null>(9).fill(null);
      for (const index of line) cells[index] = 'X';
      expect(winnerOf(cells)).toBe('X');
    }
  });

  it('reports a draw when the last cell fills without a line', () => {
    const board: ('X' | 'O' | null)[][] = [
      ['X', 'O', 'X'],
      ['X', 'O', 'O'],
      ['O', 'X', null],
    ];

    expect(placeMark(board, 2, 2, 'X')).toMatchObject({
      ok: true,
      winner: null,
      isDraw: true,
    });
  });
});
