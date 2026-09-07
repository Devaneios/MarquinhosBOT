import { describe, expect, it } from 'bun:test';
import {
  CheckersEngine,
  type Piece,
} from 'services/activity/checkers/CheckersEngine';

function emptyBoard() {
  return Array.from({ length: 8 }, () => Array<Piece | null>(8).fill(null));
}

describe('CheckersEngine', () => {
  it('sets up the standard 12-per-side starting position with black to move', () => {
    const engine = new CheckersEngine();
    const state = engine.getState();

    let black = 0;
    let red = 0;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = state.board[row]![col];
        if (!piece) continue;
        expect((row + col) % 2).toBe(1);
        expect(piece.king).toBe(false);
        if (piece.color === 'black') black++;
        else red++;
      }
    }
    expect(black).toBe(12);
    expect(red).toBe(12);
    expect(state.turn).toBe('black');
    expect(state.winner).toBeNull();
    expect(state.mustContinueFrom).toBeNull();
  });

  it('allows a simple forward diagonal move onto an empty square', () => {
    const engine = new CheckersEngine();
    const result = engine.move('black', { row: 2, col: 1 }, { row: 3, col: 0 });

    expect(result.ok).toBe(true);
    expect(result.mustContinue).toBeNull();
    const state = engine.getState();
    expect(state.board[3]![0]?.color).toBe('black');
    expect(state.board[2]![1]).toBeNull();
    expect(state.turn).toBe('red');
  });

  it('rejects a move onto an occupied square', () => {
    const engine = new CheckersEngine();
    (engine as any).board = emptyBoard();
    (engine as any).board[2][1] = { color: 'black', king: false };
    (engine as any).board[3][2] = { color: 'black', king: false };
    (engine as any).turn = 'black';

    const result = engine.move('black', { row: 2, col: 1 }, { row: 3, col: 2 });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('illegal_move');
  });

  it('rejects a move out of turn', () => {
    const engine = new CheckersEngine();
    const result = engine.move('red', { row: 5, col: 0 }, { row: 4, col: 1 });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('not_your_turn');
  });

  it('rejects a backward move for a non-king piece', () => {
    const engine = new CheckersEngine();
    engine.move('black', { row: 2, col: 1 }, { row: 3, col: 0 });
    engine.move('red', { row: 5, col: 0 }, { row: 4, col: 1 });
    const result = engine.move('black', { row: 3, col: 0 }, { row: 2, col: 1 });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('illegal_move');
  });

  it('mandatory jump: rejects a non-capture move when a capture is available', () => {
    const engine = new CheckersEngine();
    (engine as any).board = emptyBoard();
    (engine as any).board[2][1] = { color: 'black', king: false };
    (engine as any).board[3][2] = { color: 'red', king: false };
    (engine as any).board[3][4] = { color: 'red', king: false };
    (engine as any).turn = 'black';

    const nonCapture = engine.move(
      'black',
      { row: 2, col: 1 },
      { row: 3, col: 0 },
    );
    expect(nonCapture.ok).toBe(false);
    expect(nonCapture.error).toBe('illegal_move');

    const legal = engine.getLegalMoves('black');
    expect(legal.every((m) => m.captures.length > 0)).toBe(true);
  });

  it('performs a capture, removing the jumped piece', () => {
    const engine = new CheckersEngine();
    (engine as any).board = emptyBoard();
    (engine as any).board[2][1] = { color: 'black', king: false };
    (engine as any).board[3][2] = { color: 'red', king: false };
    (engine as any).turn = 'black';

    const result = engine.move('black', { row: 2, col: 1 }, { row: 4, col: 3 });
    expect(result.ok).toBe(true);
    expect(result.captured).toEqual({ row: 3, col: 2 });
    expect(result.mustContinue).toBeNull();

    const state = engine.getState();
    expect(state.board[3]![2]).toBeNull();
    expect(state.board[4]![3]?.color).toBe('black');
    expect(state.turn).toBe('red');
  });

  it('multi-jump chain: forces the same piece to keep capturing before the turn passes', () => {
    const engine = new CheckersEngine();
    (engine as any).board = emptyBoard();
    (engine as any).board[2][1] = { color: 'black', king: false };
    (engine as any).board[3][2] = { color: 'red', king: false };
    (engine as any).board[5][4] = { color: 'red', king: false };
    (engine as any).turn = 'black';

    const first = engine.move('black', { row: 2, col: 1 }, { row: 4, col: 3 });
    expect(first.ok).toBe(true);
    expect(first.mustContinue).toEqual({ row: 4, col: 3 });

    let state = engine.getState();
    expect(state.turn).toBe('black');
    expect(state.mustContinueFrom).toEqual({ row: 4, col: 3 });

    const wrongPieceMove = engine.move(
      'black',
      { row: 4, col: 3 },
      { row: 5, col: 2 },
    );
    expect(wrongPieceMove.ok).toBe(false);

    const second = engine.move('black', { row: 4, col: 3 }, { row: 6, col: 5 });
    expect(second.ok).toBe(true);
    expect(second.captured).toEqual({ row: 5, col: 4 });
    expect(second.mustContinue).toBeNull();

    state = engine.getState();
    expect(state.turn).toBe('red');
    expect(state.mustContinueFrom).toBeNull();
    expect(state.board[3]![2]).toBeNull();
    expect(state.board[5]![4]).toBeNull();
    expect(state.board[6]![5]?.color).toBe('black');
  });

  it('rejects a different piece moving while a jump chain is in progress', () => {
    const engine = new CheckersEngine();
    (engine as any).board = emptyBoard();
    (engine as any).board[2][1] = { color: 'black', king: false };
    (engine as any).board[3][2] = { color: 'red', king: false };
    (engine as any).board[5][4] = { color: 'red', king: false };
    (engine as any).board[2][5] = { color: 'black', king: false };
    (engine as any).turn = 'black';

    engine.move('black', { row: 2, col: 1 }, { row: 4, col: 3 });
    const other = engine.move('black', { row: 2, col: 5 }, { row: 3, col: 4 });
    expect(other.ok).toBe(false);
    expect(other.error).toBe('illegal_move');
  });

  it('promotes a man reaching the back row to a king', () => {
    const engine = new CheckersEngine();
    (engine as any).board = emptyBoard();
    (engine as any).board[6][1] = { color: 'black', king: false };
    (engine as any).turn = 'black';

    const result = engine.move('black', { row: 6, col: 1 }, { row: 7, col: 0 });
    expect(result.ok).toBe(true);
    expect(result.promoted).toBe(true);
    expect(engine.getState().board[7]![0]?.king).toBe(true);
  });

  it('a promotion mid-jump ends the chain even if another capture would be available', () => {
    const engine = new CheckersEngine();
    (engine as any).board = emptyBoard();
    (engine as any).board[5][2] = { color: 'black', king: false };
    (engine as any).board[6][1] = { color: 'red', king: false };
    (engine as any).board[6][3] = { color: 'red', king: false };
    (engine as any).turn = 'black';

    const result = engine.move('black', { row: 5, col: 2 }, { row: 7, col: 0 });
    expect(result.ok).toBe(true);
    expect(result.promoted).toBe(true);
    expect(result.mustContinue).toBeNull();
    expect(engine.getState().turn).toBe('red');
  });

  it('kings can move and capture backward in all four diagonal directions', () => {
    const engine = new CheckersEngine();
    (engine as any).board = emptyBoard();
    (engine as any).board[4][3] = { color: 'black', king: true };
    (engine as any).board[3][2] = { color: 'red', king: false };
    (engine as any).turn = 'black';

    const result = engine.move('black', { row: 4, col: 3 }, { row: 2, col: 1 });
    expect(result.ok).toBe(true);
    expect(result.captured).toEqual({ row: 3, col: 2 });
  });

  it('declares a winner when the opponent has no pieces left', () => {
    const engine = new CheckersEngine();
    (engine as any).board = emptyBoard();
    (engine as any).board[2][1] = { color: 'black', king: false };
    (engine as any).board[3][2] = { color: 'red', king: false };
    (engine as any).turn = 'black';

    const result = engine.move('black', { row: 2, col: 1 }, { row: 4, col: 3 });
    expect(result.ok).toBe(true);
    expect(result.winner).toBe('black');
    expect(engine.getState().winner).toBe('black');
  });

  it('declares a winner when the opponent has pieces but no legal moves', () => {
    const engine = new CheckersEngine();
    (engine as any).board = emptyBoard();
    (engine as any).board[1][0] = { color: 'red', king: false };
    (engine as any).board[0][1] = { color: 'black', king: false };
    (engine as any).board[2][1] = { color: 'black', king: false };
    (engine as any).turn = 'black';

    const result = engine.move('black', { row: 2, col: 1 }, { row: 3, col: 0 });
    expect(result.ok).toBe(true);
    expect(result.winner).toBe('black');
  });

  it('rejects moves once the game has a winner', () => {
    const engine = new CheckersEngine();
    engine.forceWinner('black');
    const result = engine.move('red', { row: 5, col: 0 }, { row: 4, col: 1 });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('game_over');
  });
});
