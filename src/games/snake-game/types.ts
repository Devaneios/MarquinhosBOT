export type SnakeDirection = 'up' | 'down' | 'left' | 'right';

export interface SnakeSegment {
  x: number;
  y: number;
}

export interface SnakeBody {
  segments: SnakeSegment[];
  direction: SnakeDirection;
  nextDirection: SnakeDirection;
  alive: boolean;
}

export interface SnakeGameState {
  width: number;
  height: number;
  snakes: Record<string, SnakeBody>;
  food: SnakeSegment[];
  scores: Record<string, number>;
  winner: string | null;
}

export interface SnakePublicConfig {
  width: number;
  height: number;
  initialSnakeLength: number;
  winningScore: number;
}

export interface SnakeSessionState {
  playerId: string | null;
  config: SnakePublicConfig | null;
  state: SnakeGameState | null;
  connected: boolean;
}
