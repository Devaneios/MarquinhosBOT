import type { TowerState } from '@marquinhos/contracts/activity/games/towerUnstable';
import { describe, expect, it } from 'bun:test';
import { applyTowerMessage, initialTowerView } from './towerMessages';

function tower(status: TowerState['status'] = 'playing'): TowerState {
  return {
    levels: [{ present: [true, true, true] }],
    pendingBlocks: 0,
    totalRemoved: 0,
    totalBlocksOriginal: 3,
    eligibleLevelCount: 1,
    currentPlayer: 'me',
    turnOrder: ['me', 'rival'],
    eliminated: [],
    status,
    winner: status === 'ended' ? 'rival' : null,
    lastPull: null,
  };
}

describe('applyTowerMessage', () => {
  it('shows a match already in progress to a viewer who joins late', () => {
    const view = applyTowerMessage(initialTowerView, {
      type: 'init',
      payload: { joined: false, state: tower() },
    });

    expect(view.joined).toBe(false);
    expect(view.state).toEqual(tower());
  });

  it('clears a rejection once the next state arrives', () => {
    const rejected = applyTowerMessage(initialTowerView, {
      type: 'action_rejected',
      payload: { error: 'Not your turn' },
    });
    const updated = applyTowerMessage(rejected, {
      type: 'state_update',
      payload: { state: tower() },
    });

    expect(rejected.error).toBe('Not your turn');
    expect(updated.error).toBeNull();
  });

  it('keeps rematch progress while the match is over and resets it on a new match', () => {
    const ended = applyTowerMessage(
      { ...initialTowerView, restartRequested: true },
      { type: 'state_update', payload: { state: tower('ended') } },
    );
    const voted = applyTowerMessage(ended, {
      type: 'restart_status',
      payload: { votes: 1, required: 2 },
    });
    const restarted = applyTowerMessage(voted, {
      type: 'state_update',
      payload: { state: tower() },
    });

    expect(voted.restartRequested).toBe(true);
    expect(voted.restartStatus).toEqual({ votes: 1, required: 2 });
    expect(restarted.restartRequested).toBe(false);
    expect(restarted.restartStatus).toBeNull();
  });

  it('tracks opponent disconnects', () => {
    const paused = applyTowerMessage(initialTowerView, {
      type: 'opponent_disconnected',
      payload: { userId: 'rival', timeoutMs: 30_000 },
    });

    expect(paused.opponentDisconnected).toBe(true);
    expect(
      applyTowerMessage(paused, {
        type: 'opponent_reconnected',
        payload: { userId: 'rival' },
      }).opponentDisconnected,
    ).toBe(false);
  });
});
