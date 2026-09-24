import type { SnakeGameState } from '@marquinhos/contracts/activity/games/snakeGame';
import { describe, expect, it } from 'bun:test';
import { applySnakeMessage, initialSnakeView } from './snakeMessages';

function state(winner: string | null = null): SnakeGameState {
  return {
    width: 20,
    height: 20,
    snakes: {},
    food: [],
    scores: { player1: 1 },
    winner,
  };
}

describe('applySnakeMessage', () => {
  it('assigns the player id and board config on init', () => {
    const config = {
      width: 30,
      height: 15,
      initialSnakeLength: 4,
      winningScore: 5,
    };
    const view = applySnakeMessage(
      initialSnakeView,
      { type: 'init', payload: { playerId: 'player2', config } },
      0,
    );

    expect(view.playerId).toBe('player2');
    expect(view.config).toEqual(config);
  });

  it('shifts the latest snapshot into prev for interpolation', () => {
    const first = applySnakeMessage(
      initialSnakeView,
      { type: 'state', payload: { seq: 1, state: state() } },
      100,
    );
    const second = applySnakeMessage(
      first,
      { type: 'state', payload: { seq: 2, state: state('player1') } },
      250,
    );

    expect(second.prev).toEqual(first.latest);
    expect(second.latest).toEqual({ state: state('player1'), receivedAt: 250 });
  });

  it('pauses on opponent disconnect and resumes on reconnect', () => {
    const paused = applySnakeMessage(
      initialSnakeView,
      {
        type: 'opponent_disconnected',
        payload: { playerId: 'player2', timeoutMs: 30_000 },
      },
      0,
    );
    const resumed = applySnakeMessage(
      paused,
      { type: 'opponent_reconnected', payload: { playerId: 'player2' } },
      0,
    );

    expect(paused.pausedOpponent).toEqual({
      playerId: 'player2',
      timeoutMs: 30_000,
    });
    expect(resumed.pausedOpponent).toBeNull();
  });
});
