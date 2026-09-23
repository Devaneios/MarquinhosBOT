import { describe, expect, it } from 'bun:test';
import {
  applyWordChainMessage,
  initialWordChainView,
  isServerReply,
} from './wordChainMessages';

const state = {
  currentWord: 'abelha',
  currentTurn: 'user-b',
  usedWords: ['abelha'],
  players: [
    { userId: 'user-a', alive: true },
    { userId: 'user-b', alive: true },
  ],
  gameOver: false,
  winner: null,
};

describe('applyWordChainMessage', () => {
  it('clears the error on init but keeps it across a state update', () => {
    const rejected = applyWordChainMessage(initialWordChainView, {
      type: 'action_rejected',
      payload: { error: 'Not your turn' },
    });

    expect(
      applyWordChainMessage(rejected, { type: 'state', payload: state }).error,
    ).toBe('Not your turn');
    expect(
      applyWordChainMessage(rejected, { type: 'init', payload: state }).error,
    ).toBeNull();
  });

  it('tracks the paused opponent', () => {
    const paused = applyWordChainMessage(initialWordChainView, {
      type: 'opponent_disconnected',
      payload: { userId: 'user-b', timeoutMs: 30_000 },
    });

    expect(paused.pausedOpponent).toEqual({
      userId: 'user-b',
      timeoutMs: 30_000,
    });
    expect(
      applyWordChainMessage(paused, {
        type: 'opponent_reconnected',
        payload: { userId: 'user-b' },
      }).pausedOpponent,
    ).toBeNull();
  });

  it('counts state and rejections as replies that cancel the no-response timer', () => {
    expect(isServerReply({ type: 'state', payload: state })).toBe(true);
    expect(
      isServerReply({ type: 'action_rejected', payload: { error: 'x' } }),
    ).toBe(true);
    expect(
      isServerReply({
        type: 'opponent_disconnected',
        payload: { userId: 'user-b', timeoutMs: 1 },
      }),
    ).toBe(false);
  });
});
