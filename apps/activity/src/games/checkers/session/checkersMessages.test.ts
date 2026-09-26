import type { CheckersState } from '@marquinhos/contracts/activity/games/checkers';
import { describe, expect, it } from 'bun:test';
import { applyCheckersMessage, initialCheckersView } from './checkersMessages';

const state: CheckersState = {
  board: [],
  turn: 'black',
  winner: null,
  mustContinueFrom: null,
};

describe('applyCheckersMessage', () => {
  it('takes the seat color and state from init', () => {
    const view = applyCheckersMessage(initialCheckersView, {
      type: 'init',
      payload: { color: 'red', state },
    });

    expect(view.myColor).toBe('red');
    expect(view.state).toEqual(state);
  });

  it('flags a rejected move and bumps the selection reset signal', () => {
    const view = applyCheckersMessage(initialCheckersView, {
      type: 'action_rejected',
      payload: { error: 'Invalid move' },
    });

    expect(view.notice).toBe('moveRejected');
    expect(view.clearSelectionSignal).toBe(1);
  });

  it('shows and clears the opponent disconnect notice', () => {
    const disconnected = applyCheckersMessage(initialCheckersView, {
      type: 'opponent_disconnected',
      payload: { color: 'red', timeoutMs: 30_000 },
    });
    const reconnected = applyCheckersMessage(disconnected, {
      type: 'opponent_reconnected',
      payload: { color: 'red' },
    });

    expect(disconnected.notice).toBe('opponentDisconnected');
    expect(reconnected.notice).toBeNull();
  });
});
