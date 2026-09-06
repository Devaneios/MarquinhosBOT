export interface GameState {
  currentWord: string;
  currentTurn: string;
  usedWords: string[];
  players: { userId: string; alive: boolean }[];
  gameOver: boolean;
  winner: string | null;
  userId: string;
}

export interface WordRejectedPayload {
  error: string;
}

export interface OpponentDisconnectedPayload {
  userId: string;
  timeoutMs: number;
}
