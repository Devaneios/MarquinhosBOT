import { describe, expect, it } from 'bun:test';
import {
  advanceAfterRoundResult,
  applyRpsMessage,
  initialRpsView,
} from './rpsMessages';

const roundState = {
  round: 1,
  bestOf: 3,
  submitted: [],
  scores: { player1: 0, player2: 0 },
};

const result = {
  round: 1,
  p1Pick: 'rock' as const,
  p2Pick: 'scissors' as const,
  winner: 'player1' as const,
};

describe('applyRpsMessage', () => {
  it('shows a round result and then advances to the next round', () => {
    const shown = applyRpsMessage(
      { ...initialRpsView, phase: 'playing', roundState, myPick: 'rock' },
      { type: 'round_result', payload: result },
    );
    const advanced = advanceAfterRoundResult(shown);

    expect(shown.phase).toBe('round_result');
    expect(shown.myPick).toBeNull();
    expect(advanced.phase).toBe('playing');
    expect(advanced.roundState?.round).toBe(2);
  });

  it('stays on the end screen when the match ends right after the last round', () => {
    const ended = applyRpsMessage(
      applyRpsMessage(
        { ...initialRpsView, phase: 'playing', roundState },
        { type: 'round_result', payload: result },
      ),
      { type: 'match_end', payload: { winner: 'user-a', history: [result] } },
    );

    expect(advanceAfterRoundResult(ended).phase).toBe('match_end');
  });
});
