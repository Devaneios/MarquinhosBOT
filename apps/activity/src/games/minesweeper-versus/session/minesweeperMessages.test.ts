import type { BoardSnapshot } from '@marquinhos/contracts/activity/games/minesweeperVersus';
import { describe, expect, it } from 'bun:test';
import {
  applyMinesweeperMessage,
  initialMinesweeperView,
} from './minesweeperMessages';

const board: BoardSnapshot = {
  width: 2,
  height: 1,
  grid: [[{ revealed: false }, { revealed: false }]],
  scores: { me: 0 },
  gameOver: false,
};

describe('applyMinesweeperMessage', () => {
  it('ignores reveals until the board snapshot has arrived', () => {
    const view = applyMinesweeperMessage(initialMinesweeperView, {
      type: 'reveal',
      payload: {
        userId: 'me',
        revealedTiles: [],
        pointsDelta: 0,
        hitMine: false,
        gameOver: false,
        scores: {},
      },
    });

    expect(view).toBe(initialMinesweeperView);
  });

  it('applies revealed tiles and scores onto the board', () => {
    const loaded = applyMinesweeperMessage(initialMinesweeperView, {
      type: 'init',
      payload: board,
    });
    const view = applyMinesweeperMessage(loaded, {
      type: 'reveal',
      payload: {
        userId: 'me',
        revealedTiles: [
          { x: 1, y: 0, mine: false, adjacent: 1, revealedBy: 'me' },
        ],
        pointsDelta: 1,
        hitMine: false,
        gameOver: false,
        scores: { me: 1 },
      },
    });

    expect(view.board?.grid[0]).toEqual([
      { revealed: false },
      { revealed: true, mine: false, adjacent: 1, revealedBy: 'me' },
    ]);
    expect(view.board?.scores).toEqual({ me: 1 });
  });

  it('shows a reveal error and clears it when a fresh board arrives', () => {
    const errored = applyMinesweeperMessage(initialMinesweeperView, {
      type: 'reveal_error',
      payload: { message: 'already_revealed' },
    });

    expect(errored.errorMsg).toBe('already_revealed');
    expect(
      applyMinesweeperMessage(errored, { type: 'init', payload: board })
        .errorMsg,
    ).toBeNull();
  });

  it('marks the board over on game_over', () => {
    const loaded = applyMinesweeperMessage(initialMinesweeperView, {
      type: 'init',
      payload: board,
    });
    const view = applyMinesweeperMessage(loaded, {
      type: 'game_over',
      payload: { scores: { me: 7 } },
    });

    expect(view.board?.gameOver).toBe(true);
    expect(view.board?.scores).toEqual({ me: 7 });
  });
});
