import type {
  ConnectFourServerMessage,
  ConnectFourState,
  Disc,
} from '@marquinhos/contracts/activity/games/connectFour';

export interface ConnectFourView {
  mySide: Disc | null;
  state: ConnectFourState | null;
  opponentDisconnected: boolean;
  restartStatus: { votes: number; required: number } | null;
}

export const initialConnectFourView: ConnectFourView = {
  mySide: null,
  state: null,
  opponentDisconnected: false,
  restartStatus: null,
};

export function applyConnectFourMessage(
  view: ConnectFourView,
  message: ConnectFourServerMessage,
): ConnectFourView {
  switch (message.type) {
    case 'init':
      return {
        ...view,
        mySide: message.payload.disc,
        state: message.payload.state,
      };
    case 'state':
      return {
        ...view,
        state: message.payload,
        opponentDisconnected: false,
        restartStatus: null,
      };
    case 'opponent_disconnected':
      return { ...view, opponentDisconnected: true };
    case 'opponent_reconnected':
      return { ...view, opponentDisconnected: false };
    case 'restart_status':
      return { ...view, restartStatus: message.payload };
    case 'move_rejected':
      return view;
  }
}
