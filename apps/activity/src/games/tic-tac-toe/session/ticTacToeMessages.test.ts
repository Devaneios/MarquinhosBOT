import { describe, expect, it } from 'bun:test';
import {
  applyTicTacToeMessage,
  initialTicTacToeView,
} from './ticTacToeMessages';

describe('applyTicTacToeMessage', () => {
  it('takes the seat and state from init', () => {
    const view = applyTicTacToeMessage(initialTicTacToeView, {
      type: 'init',
      payload: { player: 'O', state: initialTicTacToeView.state },
    });

    expect(view.player).toBe('O');
  });

  it('keeps the latest board from state_update and game_ready', () => {
    const moved = {
      ...initialTicTacToeView.state,
      moveCount: 1,
      currentPlayer: 'O' as const,
    };
    const afterUpdate = applyTicTacToeMessage(initialTicTacToeView, {
      type: 'state_update',
      payload: moved,
    });
    const afterReady = applyTicTacToeMessage(afterUpdate, {
      type: 'game_ready',
      payload: { state: initialTicTacToeView.state },
    });

    expect(afterUpdate.state.moveCount).toBe(1);
    expect(afterReady.state.moveCount).toBe(0);
  });

  it('surfaces a rejected move as the error text', () => {
    const view = applyTicTacToeMessage(initialTicTacToeView, {
      type: 'action_rejected',
      payload: { error: 'Not your turn' },
    });

    expect(view.error).toBe('Not your turn');
  });
});
