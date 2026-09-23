import type {
  WordleRaceServerMessage,
  WordleRaceState,
} from '@marquinhos/contracts/activity/games/wordleRace';
import type { LetterFeedback } from '@marquinhos/contracts/wordle';
import { describe, expect, it } from 'bun:test';
import {
  applyWordleRaceMessage,
  initialWordleRaceView,
} from './wordleRaceMessages';

const state: WordleRaceState = {
  targetWordLength: 5,
  maxAttempts: 6,
  players: [
    { userId: 'me', attempts: 0, solved: false, exhausted: false, guesses: [] },
    {
      userId: 'rival',
      attempts: 0,
      solved: false,
      exhausted: false,
      guesses: [],
    },
  ],
  firstSolver: null,
  gameOver: false,
  currentPlayerGuesses: [],
  currentPlayerSolved: false,
  currentPlayerExhausted: false,
};

const feedback: LetterFeedback[] = [
  'absent',
  'absent',
  'absent',
  'absent',
  'absent',
];

const submitted: WordleRaceServerMessage = {
  type: 'guess_submitted',
  payload: {
    userId: 'me',
    guess: 'abrir',
    feedback,
    attempts: 1,
    solved: false,
  },
};

describe('applyWordleRaceMessage', () => {
  it('appends a guess exactly once even when applied twice to the same view', () => {
    const view = { ...initialWordleRaceView, state };
    applyWordleRaceMessage(view, submitted, 'me');
    const next = applyWordleRaceMessage(view, submitted, 'me');

    expect(state.players[0]!.guesses).toEqual([]);
    expect(next.state?.players[0]!.guesses).toHaveLength(1);
    expect(next.state?.currentPlayerGuesses).toHaveLength(1);
  });

  it('marks only the exhausted player, and the current player when it is them', () => {
    const view = applyWordleRaceMessage(
      { ...initialWordleRaceView, state },
      { type: 'player_exhausted', payload: { userId: 'rival' } },
      'me',
    );

    expect(view.state?.players.map((p) => p.exhausted)).toEqual([false, true]);
    expect(view.state?.currentPlayerExhausted).toBe(false);
  });
});
