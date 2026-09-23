import { describe, expect, it } from 'bun:test';
import {
  applyConnectFourMessage,
  initialConnectFourView,
} from './connectFourMessages';

const state = {
  grid: [],
  currentTurn: 'p1' as const,
  winner: null,
  winningLine: null,
  isDraw: false,
};

describe('applyConnectFourMessage', () => {
  it('takes the disc and state from init', () => {
    const view = applyConnectFourMessage(initialConnectFourView, {
      type: 'init',
      payload: { disc: 'p2', state },
    });

    expect(view.mySide).toBe('p2');
    expect(view.state).toEqual(state);
  });

  it('clears the disconnect notice and restart votes on a new state', () => {
    const waiting = applyConnectFourMessage(
      applyConnectFourMessage(initialConnectFourView, {
        type: 'opponent_disconnected',
        payload: { disc: 'p2', timeoutMs: 30_000 },
      }),
      { type: 'restart_status', payload: { votes: 1, required: 2 } },
    );
    const next = applyConnectFourMessage(waiting, {
      type: 'state',
      payload: state,
    });

    expect(waiting.opponentDisconnected).toBe(true);
    expect(waiting.restartStatus).toEqual({ votes: 1, required: 2 });
    expect(next.opponentDisconnected).toBe(false);
    expect(next.restartStatus).toBeNull();
  });
});
