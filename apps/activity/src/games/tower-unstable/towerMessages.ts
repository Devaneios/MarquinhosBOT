import type {
  TowerServerMessage,
  TowerState,
} from '@marquinhos/contracts/activity/games/towerUnstable';

export interface TowerView {
  state: TowerState | null;
  joined: boolean;
  error: string | null;
  opponentDisconnected: boolean;
  restartStatus: { votes: number; required: number } | null;
  restartRequested: boolean;
}

export const initialTowerView: TowerView = {
  state: null,
  joined: true,
  error: null,
  opponentDisconnected: false,
  restartStatus: null,
  restartRequested: false,
};

function withState(view: TowerView, state: TowerState): TowerView {
  const next = { ...view, state, error: null, opponentDisconnected: false };
  if (state.status !== 'playing') return next;
  return { ...next, restartStatus: null, restartRequested: false };
}

export function applyTowerMessage(
  view: TowerView,
  message: TowerServerMessage,
): TowerView {
  switch (message.type) {
    case 'init': {
      const joined = { ...view, joined: message.payload.joined };
      return message.payload.state
        ? withState(joined, message.payload.state)
        : joined;
    }
    case 'game_ready':
    case 'state_update':
      return withState(view, message.payload.state);
    case 'action_rejected':
      return { ...view, error: message.payload.error };
    case 'restart_status':
      return { ...view, restartStatus: message.payload };
    case 'opponent_disconnected':
      return { ...view, opponentDisconnected: true };
    case 'opponent_reconnected':
      return { ...view, opponentDisconnected: false };
  }
}
