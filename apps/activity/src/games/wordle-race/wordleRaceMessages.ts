import type {
  WordleRaceServerMessage,
  WordleRaceState,
} from '@marquinhos/contracts/activity/games/wordleRace';
import { ACTION_REJECTED } from '@marquinhos/contracts/activity/protocol';

export interface WordleRaceView {
  state: WordleRaceState | null;
  error: string | null;
}

export const initialWordleRaceView: WordleRaceView = {
  state: null,
  error: null,
};

export function applyWordleRaceMessage(
  view: WordleRaceView,
  message: WordleRaceServerMessage,
  userId: string,
): WordleRaceView {
  switch (message.type) {
    case 'init':
      return { state: message.payload, error: null };
    case ACTION_REJECTED:
      return { ...view, error: message.payload.error };
    case 'guess_submitted': {
      if (!view.state) return { ...view, error: null };
      const {
        userId: guesser,
        guess,
        feedback,
        attempts,
        solved,
      } = message.payload;
      const row = { guess, feedback };
      const mine = guesser === userId;
      return {
        error: null,
        state: {
          ...view.state,
          currentPlayerGuesses: mine
            ? [...view.state.currentPlayerGuesses, row]
            : view.state.currentPlayerGuesses,
          currentPlayerSolved: mine ? solved : view.state.currentPlayerSolved,
          players: view.state.players.map((player) =>
            player.userId === guesser
              ? {
                  ...player,
                  attempts,
                  solved,
                  guesses: [...player.guesses, row],
                }
              : player,
          ),
        },
      };
    }
    case 'player_solved':
      if (!view.state || !message.payload.firstSolver) return view;
      return {
        ...view,
        state: { ...view.state, firstSolver: message.payload.userId },
      };
    case 'player_exhausted': {
      if (!view.state) return view;
      const exhausted = message.payload.userId;
      return {
        ...view,
        state: {
          ...view.state,
          currentPlayerExhausted:
            exhausted === userId || view.state.currentPlayerExhausted,
          players: view.state.players.map((player) =>
            player.userId === exhausted
              ? { ...player, exhausted: true }
              : player,
          ),
        },
      };
    }
    case 'game_ended':
      if (!view.state) return view;
      return { ...view, state: { ...view.state, gameOver: true } };
    case 'player_joined':
    case 'player_left':
      return view;
  }
}
