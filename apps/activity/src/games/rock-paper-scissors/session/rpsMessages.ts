import type {
  RoundResult,
  RpsPick,
  RpsPlayerId,
  RpsRoundState,
  RpsServerMessage,
} from '@marquinhos/contracts/activity/games/rockPaperScissors';
import type { GamePhase } from '../types';

export interface RpsView {
  playerId: RpsPlayerId | null;
  phase: GamePhase;
  roundState: RpsRoundState | null;
  myPick: RpsPick | null;
  roundResult: RoundResult | null;
  error: string | null;
}

export const initialRpsView: RpsView = {
  playerId: null,
  phase: 'waiting',
  roundState: null,
  myPick: null,
  roundResult: null,
  error: null,
};

export const ROUND_RESULT_DISPLAY_MS = 2000;

export function applyRpsMessage(
  view: RpsView,
  message: RpsServerMessage,
): RpsView {
  switch (message.type) {
    case 'init':
      return { ...view, playerId: message.payload.playerId };
    case 'game_start':
      return { ...view, phase: 'playing' };
    case 'round_state':
      return { ...view, roundState: message.payload };
    case 'round_result':
      return {
        ...view,
        roundResult: message.payload,
        phase: 'round_result',
        myPick: null,
      };
    case 'match_end':
      return { ...view, phase: 'match_end' };
    case 'error':
      return { ...view, error: message.payload.message };
    case 'opponent_disconnected':
      return view;
  }
}

export function advanceAfterRoundResult(view: RpsView): RpsView {
  if (view.phase !== 'round_result' || !view.roundResult) return view;
  const nextRound = view.roundResult.round + 1;
  return {
    ...view,
    phase: 'playing',
    roundState:
      view.roundState && view.roundState.round < nextRound
        ? { ...view.roundState, round: nextRound }
        : view.roundState,
  };
}
