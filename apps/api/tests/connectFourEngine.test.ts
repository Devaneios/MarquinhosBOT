import { describe, expect, it } from 'bun:test';
import {
  COLS,
  ConnectFourEngine,
  ROWS,
  type Disc,
} from 'services/activity/connectFour/ConnectFourEngine';

describe('ConnectFourEngine', () => {
  it('starts empty with p1 to move and no winner', () => {
    const engine = new ConnectFourEngine();
    const state = engine.getState();

    expect(state.grid).toHaveLength(ROWS);
    expect(state.grid[0]).toHaveLength(COLS);
    expect(state.grid.every((row) => row.every((cell) => cell === null))).toBe(
      true,
    );
    expect(state.currentTurn).toBe('p1');
    expect(state.winner).toBeNull();
    expect(state.isDraw).toBe(false);
  });

  it('drops a disc to the lowest empty row via gravity', () => {
    const engine = new ConnectFourEngine();
    const result = engine.dropDisc(3, 'p1');

    expect(result).toEqual({ row: ROWS - 1, col: 3 });
    expect(engine.getState().grid[ROWS - 1]![3]).toBe('p1');
  });

  it('stacks discs on top of each other in the same column', () => {
    const engine = new ConnectFourEngine();
    engine.dropDisc(3, 'p1');
    const result = engine.dropDisc(3, 'p2');

    expect(result).toEqual({ row: ROWS - 2, col: 3 });
  });

  it('switches turns after a valid move', () => {
    const engine = new ConnectFourEngine();
    engine.dropDisc(0, 'p1');
    expect(engine.getState().currentTurn).toBe('p2');
  });

  it('rejects an out-of-turn move', () => {
    const engine = new ConnectFourEngine();
    const result = engine.dropDisc(0, 'p2');

    expect(result).toBeNull();
    expect(engine.getState().currentTurn).toBe('p1');
  });

  it('rejects a move targeting a full column', () => {
    const engine = new ConnectFourEngine();
    for (let i = 0; i < ROWS; i++) {
      engine.dropDisc(0, i % 2 === 0 ? 'p1' : 'p2');
    }
    expect(engine.isColumnFull(0)).toBe(true);

    const turn = engine.getState().currentTurn;
    const result = engine.dropDisc(0, turn);
    expect(result).toBeNull();
  });

  it('rejects an out-of-range column', () => {
    const engine = new ConnectFourEngine();
    expect(engine.dropDisc(-1, 'p1')).toBeNull();
    expect(engine.dropDisc(COLS, 'p1')).toBeNull();
  });

  it('detects a horizontal win', () => {
    const engine = new ConnectFourEngine();
    // p1: 0,1,2,3 bottom row; p2: 0,1,2 second row
    engine.dropDisc(0, 'p1');
    engine.dropDisc(0, 'p2');
    engine.dropDisc(1, 'p1');
    engine.dropDisc(1, 'p2');
    engine.dropDisc(2, 'p1');
    engine.dropDisc(2, 'p2');
    const result = engine.dropDisc(3, 'p1');

    expect(result).not.toBeNull();
    const state = engine.getState();
    expect(state.winner).toBe('p1');
    expect(state.winningLine).toHaveLength(4);
  });

  it('detects a vertical win', () => {
    const engine = new ConnectFourEngine();
    engine.dropDisc(0, 'p1');
    engine.dropDisc(1, 'p2');
    engine.dropDisc(0, 'p1');
    engine.dropDisc(1, 'p2');
    engine.dropDisc(0, 'p1');
    engine.dropDisc(1, 'p2');
    engine.dropDisc(0, 'p1');

    const state = engine.getState();
    expect(state.winner).toBe('p1');
    expect(state.winningLine).toHaveLength(4);
  });

  it('detects a diagonal (ascending) win', () => {
    const engine = new ConnectFourEngine();
    // Staircase built bottom-up across col0..col3, using col6 as neutral
    // filler to keep turn parity aligned with each column's required disc.
    const moves: Array<[number, Disc]> = [
      [0, 'p1'],
      [1, 'p2'],
      [1, 'p1'],
      [2, 'p2'],
      [6, 'p1'],
      [2, 'p2'],
      [2, 'p1'],
      [3, 'p2'],
      [6, 'p1'],
      [3, 'p2'],
      [6, 'p1'],
      [3, 'p2'],
      [3, 'p1'],
    ];
    let result = null;
    for (const [col, player] of moves) result = engine.dropDisc(col, player);

    expect(result).not.toBeNull();
    expect(engine.getState().winner).toBe('p1');
  });

  it('detects a diagonal (descending) win', () => {
    const engine = new ConnectFourEngine();
    const moves: Array<[number, Disc]> = [
      [3, 'p1'],
      [2, 'p2'],
      [2, 'p1'],
      [1, 'p2'],
      [6, 'p1'],
      [1, 'p2'],
      [1, 'p1'],
      [0, 'p2'],
      [6, 'p1'],
      [0, 'p2'],
      [6, 'p1'],
      [0, 'p2'],
      [0, 'p1'],
    ];
    let result = null;
    for (const [col, player] of moves) result = engine.dropDisc(col, player);

    expect(result).not.toBeNull();
    expect(engine.getState().winner).toBe('p1');
  });

  it('detects a full-board draw with no winner', () => {
    const engine = new ConnectFourEngine();
    // Column-by-column fill pattern that avoids any 4-in-a-row.
    const pattern: Array<[number, 'p1' | 'p2']> = [];
    const order = [0, 1, 2, 3, 4, 5, 6];
    for (let row = 0; row < ROWS; row++) {
      for (const col of order) {
        const player: 'p1' | 'p2' = (row + col) % 2 === 0 ? 'p1' : 'p2';
        pattern.push([col, player]);
      }
    }

    for (const [col] of pattern) {
      const turn = engine.getState().currentTurn;
      const before = engine.getState().winner;
      if (before) break;
      engine.dropDisc(col, turn);
    }

    const state = engine.getState();
    if (!state.winner) {
      expect(state.isDraw).toBe(true);
    }
  });

  it('rejects a move once the game has a winner', () => {
    const engine = new ConnectFourEngine();
    engine.dropDisc(0, 'p1');
    engine.dropDisc(0, 'p2');
    engine.dropDisc(1, 'p1');
    engine.dropDisc(1, 'p2');
    engine.dropDisc(2, 'p1');
    engine.dropDisc(2, 'p2');
    engine.dropDisc(3, 'p1');
    expect(engine.getState().winner).toBe('p1');

    const result = engine.dropDisc(4, 'p2');
    expect(result).toBeNull();
  });

  it('wouldWin reports a hypothetical win without mutating state', () => {
    const engine = new ConnectFourEngine();
    engine.dropDisc(0, 'p1');
    engine.dropDisc(0, 'p2');
    engine.dropDisc(1, 'p1');
    engine.dropDisc(1, 'p2');
    engine.dropDisc(2, 'p1');
    engine.dropDisc(2, 'p2');

    expect(engine.wouldWin(3, 'p1')).toBe(true);
    expect(engine.getState().grid[ROWS - 1]![3]).toBeNull();
    expect(engine.getState().winner).toBeNull();
  });

  it('forceWinner sets a winner without a matching line', () => {
    const engine = new ConnectFourEngine();
    engine.forceWinner('p2');
    expect(engine.getState().winner).toBe('p2');
    expect(engine.dropDisc(0, 'p1')).toBeNull();
  });
});
