import type {
  SnakeGameState,
  SnakePublicConfig,
  SnakeServerMessage,
} from '@marquinhos/contracts/activity/games/snakeGame';

export interface SnakeSnapshot {
  state: SnakeGameState;
  receivedAt: number;
}

export interface SnakeView {
  playerId: string | null;
  config: SnakePublicConfig;
  latest: SnakeSnapshot | null;
  prev: SnakeSnapshot | null;
  pausedOpponent: { playerId: string; timeoutMs: number } | null;
}

export const initialSnakeView: SnakeView = {
  playerId: null,
  config: { width: 20, height: 20, initialSnakeLength: 3, winningScore: 10 },
  latest: null,
  prev: null,
  pausedOpponent: null,
};

export function applySnakeMessage(
  view: SnakeView,
  message: SnakeServerMessage,
  receivedAt: number,
): SnakeView {
  switch (message.type) {
    case 'init':
      return {
        ...view,
        playerId: message.payload.playerId,
        config: message.payload.config,
      };
    case 'state':
      return {
        ...view,
        prev: view.latest,
        latest: { state: message.payload.state, receivedAt },
      };
    case 'opponent_disconnected':
      return { ...view, pausedOpponent: message.payload };
    case 'opponent_reconnected':
      return { ...view, pausedOpponent: null };
    case 'input_error':
      return view;
  }
}
