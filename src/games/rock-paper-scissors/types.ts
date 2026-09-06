export type RpsPick = 'rock' | 'paper' | 'scissors';

export interface RoundResult {
  round: number;
  p1Pick: RpsPick;
  p2Pick: RpsPick;
  winner: string | null;
}

export interface RpsState {
  round: number;
  bestOf: number;
  submitted: string[];
  scores: {
    player1: number;
    player2: number;
  };
}

export type GamePhase = 'waiting' | 'playing' | 'round_result' | 'match_end';

export type RpsPlayerId = 'player1' | 'player2';

export interface RpsErrorPayload {
  message: string;
}
