import type {
  BattleshipServerMessage,
  BattleshipSide,
  BattleshipStateView,
} from '@marquinhos/contracts/activity/games/battleship';

export interface BattleshipView {
  side: BattleshipSide | null;
  state: BattleshipStateView | null;
  placementError: string | null;
  fireError: string | null;
}

export const initialBattleshipView: BattleshipView = {
  side: null,
  state: null,
  placementError: null,
  fireError: null,
};

export function applyBattleshipMessage(
  view: BattleshipView,
  message: BattleshipServerMessage,
): BattleshipView {
  switch (message.type) {
    case 'init':
      return { ...view, side: message.payload.side };
    case 'state':
      if (!('own' in message.payload)) return view;
      return {
        ...view,
        state: message.payload,
        placementError: null,
        fireError: null,
      };
    case 'placement_error':
      return { ...view, placementError: message.payload.message };
    case 'fire_error':
      return { ...view, fireError: message.payload.message };
    case 'opponent_disconnected':
    case 'opponent_reconnected':
      return view;
  }
}
