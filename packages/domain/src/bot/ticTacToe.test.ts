import { describe, expect, it } from 'bun:test';
import {
  applyTicTacToeMove,
  createTicTacToeState,
  forfeitTicTacToeTurn,
  getTicTacToeRewardBonuses,
  getTicTacToeScores,
} from './ticTacToe';

describe('Tic Tac Toe rules', () => {
  it('alternates valid moves and records a line winner', () => {
    let state = createTicTacToeState();
    state = applyTicTacToeMove(state, 0, 0);
    state = applyTicTacToeMove(state, 1, 0);
    state = applyTicTacToeMove(state, 0, 1);
    state = applyTicTacToeMove(state, 1, 1);
    state = applyTicTacToeMove(state, 0, 2);

    expect(state.winnerIndex).toBe(0);
    expect(state.gameOver).toBe(true);
    expect(getTicTacToeScores(state)).toEqual([100, 20]);
    expect(getTicTacToeRewardBonuses(state)).toEqual([20, 0]);
  });

  it('ignores occupied and out-of-range moves', () => {
    const state = applyTicTacToeMove(createTicTacToeState(), 0, 0);

    expect(applyTicTacToeMove(state, 0, 0)).toEqual(state);
    expect(applyTicTacToeMove(state, 3, 0)).toEqual(state);
  });

  it('awards a draw and a timeout forfeit using the game scores', () => {
    const draws = [
      [0, 0], [1, 1], [0, 1], [0, 2], [2, 0],
      [1, 0], [1, 2], [2, 1], [2, 2],
    ] as const;
    const state = draws.reduce(
      (current, [row, col]) => applyTicTacToeMove(current, row, col),
      createTicTacToeState(),
    );

    expect(state.isDraw).toBe(true);
    expect(getTicTacToeScores(state)).toEqual([50, 50]);
    expect(getTicTacToeRewardBonuses(state)).toEqual([10, 10]);

    const forfeit = forfeitTicTacToeTurn(createTicTacToeState(), 0);
    expect(forfeit.winnerIndex).toBe(1);
    expect(forfeit.timedOut).toBe(true);
    expect(getTicTacToeScores(forfeit)).toEqual([20, 100]);
  });
});
