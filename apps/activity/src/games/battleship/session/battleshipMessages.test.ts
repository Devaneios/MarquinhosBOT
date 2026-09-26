import type { BattleshipStateView } from '@marquinhos/contracts/activity/games/battleship';
import { describe, expect, it } from 'bun:test';
import {
  applyBattleshipMessage,
  initialBattleshipView,
} from './battleshipMessages';

const emptyBoard = { ships: [], shots: [] };
const playerState: BattleshipStateView = {
  phase: 'battle',
  turn: 'p1',
  winner: null,
  own: emptyBoard,
  opponent: emptyBoard,
  placementReady: { p1: true, p2: true },
};

describe('applyBattleshipMessage', () => {
  it('records the assigned side', () => {
    expect(
      applyBattleshipMessage(initialBattleshipView, {
        type: 'init',
        payload: { side: 'p2' },
      }).side,
    ).toBe('p2');
  });

  it('clears both errors when a player state arrives', () => {
    const errored = applyBattleshipMessage(
      applyBattleshipMessage(initialBattleshipView, {
        type: 'placement_error',
        payload: { message: 'overlap' },
      }),
      { type: 'fire_error', payload: { message: 'Not your turn' } },
    );
    const updated = applyBattleshipMessage(errored, {
      type: 'state',
      payload: playerState,
    });

    expect(errored.placementError).toBe('overlap');
    expect(errored.fireError).toBe('Not your turn');
    expect(updated).toEqual({
      ...initialBattleshipView,
      state: playerState,
    });
  });

  it('ignores the spectator view', () => {
    expect(
      applyBattleshipMessage(initialBattleshipView, {
        type: 'state',
        payload: {
          phase: 'battle',
          turn: 'p1',
          winner: null,
          p1: emptyBoard,
          p2: emptyBoard,
          placementReady: { p1: true, p2: true },
        },
      }),
    ).toBe(initialBattleshipView);
  });
});
