export type GameMode = 'multi' | 'single';

export interface BingoCard {
  board: number[][];
  marked: boolean[][];
}

export interface BingoInitPayload {
  card: BingoCard;
  state?: {
    drawnNumbers: number[];
    playerCount: number;
    gameStarted: boolean;
  };
}

export interface BingoNumberDrawnPayload {
  number: number;
}

export interface BingoGameEndPayload {
  winner?: string;
}
