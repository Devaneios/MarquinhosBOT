import type { DominoesClientState } from '@marquinhos/contracts/activity/games/dominoesBlock';
import { describe, expect, it } from 'bun:test';
import { applyDominoesMessage, initialDominoesView } from './dominoesMessages';

function table(winner: string | null = null): DominoesClientState {
  return {
    players: ['me', 'rival'],
    handCounts: { me: 7, rival: 7 },
    hand: [{ a: 1, b: 2 }],
    boneyard: 14,
    chain: [],
    leftEnd: null,
    rightEnd: null,
    currentPlayer: winner ? null : 'me',
    winner,
    winners: winner ? [winner] : null,
    blocked: false,
    pipTotals: null,
  };
}

describe('applyDominoesMessage', () => {
  it('keeps a pending rematch vote when the finished table is re-sent', () => {
    const voted = applyDominoesMessage(
      { ...initialDominoesView, restartRequested: true },
      { type: 'restart_status', payload: { votes: 1, required: 2 } },
    );
    const resent = applyDominoesMessage(voted, {
      type: 'state',
      payload: table('me'),
    });

    expect(resent.restartRequested).toBe(true);
    expect(resent.restartStatus).toEqual({ votes: 1, required: 2 });
  });

  it('clears rematch progress once a new match is dealt', () => {
    const voted = applyDominoesMessage(
      { ...initialDominoesView, restartRequested: true },
      { type: 'restart_status', payload: { votes: 1, required: 2 } },
    );
    const dealt = applyDominoesMessage(voted, {
      type: 'state',
      payload: table(),
    });

    expect(dealt.restartRequested).toBe(false);
    expect(dealt.restartStatus).toBeNull();
  });

  it('shows a rejection until the next state arrives', () => {
    const rejected = applyDominoesMessage(initialDominoesView, {
      type: 'move_rejected',
      payload: { reason: 'Not your turn' },
    });

    expect(rejected.rejection).toBe('Not your turn');
    expect(
      applyDominoesMessage(rejected, { type: 'state', payload: table() })
        .rejection,
    ).toBeNull();
  });

  it('tracks a disconnected opponent', () => {
    const paused = applyDominoesMessage(initialDominoesView, {
      type: 'opponent_disconnected',
      payload: { userId: 'rival', timeoutMs: 30_000 },
    });

    expect(paused.disconnectedOpponent).toEqual({
      userId: 'rival',
      timeoutMs: 30_000,
    });
    expect(
      applyDominoesMessage(paused, {
        type: 'opponent_reconnected',
        payload: { userId: 'rival' },
      }).disconnectedOpponent,
    ).toBeNull();
  });
});
