export interface BingoCard {
  board: number[][];
  marked: boolean[][];
}

export interface BingoSpeedGameState {
  status: 'selecting-mode' | 'connecting' | 'playing' | 'finished' | 'error';
  card?: BingoCard;
  drawnNumbers: number[];
  playerCount: number;
  gameStarted: boolean;
  winner?: string;
  error?: string;
}

export interface BingoSpeedSession {
  status: 'selecting-mode' | 'connecting' | 'playing' | 'finished' | 'error';
  session?: {
    room: any;
    card?: BingoCard;
    userId: string;
  };
  card?: BingoCard;
  drawnNumbers: number[];
  playerCount: number;
  gameStarted: boolean;
  winner?: string;
  error?: string;
  mode: 'multi' | 'single';
  sound: boolean;
}
