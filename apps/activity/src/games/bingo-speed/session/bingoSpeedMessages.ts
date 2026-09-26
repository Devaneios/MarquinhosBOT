import type {
  BingoCard,
  BingoSpeedServerMessage,
} from '@marquinhos/contracts/activity/games/bingoSpeed';

export interface BingoSpeedView {
  card: BingoCard | null;
  drawnNumbers: Set<number>;
  cardLoaded: boolean;
  winner: string | null;
}

export const initialBingoSpeedView: BingoSpeedView = {
  card: null,
  drawnNumbers: new Set(),
  cardLoaded: false,
  winner: null,
};

export function applyBingoSpeedMessage(
  view: BingoSpeedView,
  message: BingoSpeedServerMessage,
): BingoSpeedView {
  switch (message.type) {
    case 'init':
      return {
        ...view,
        card: message.payload.card,
        drawnNumbers: new Set(message.payload.state.drawnNumbers),
        cardLoaded: true,
      };
    case 'number_drawn':
      return {
        ...view,
        drawnNumbers: new Set(view.drawnNumbers).add(message.payload.number),
      };
    case 'game_end':
      return { ...view, winner: message.payload.winner };
    case 'game_started':
    case 'bingo_claim_result':
    case 'opponent_disconnected':
    case 'opponent_reconnected':
      return view;
  }
}
