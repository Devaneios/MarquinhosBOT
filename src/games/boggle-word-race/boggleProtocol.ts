export interface Cell {
  row: number;
  col: number;
}

export interface InitPayload {
  grid: string[][];
  state: {
    grid: string[][];
    timeRemainingMs: number;
    ended: boolean;
    players: { userId: string; score: number; wordCount: number }[];
  };
}

export interface WordAcceptedPayload {
  userId: string;
  word: string;
  points: number;
  totalScore: number;
}

export interface SubmitErrorPayload {
  reason:
    | 'not_started'
    | 'already_ended'
    | 'unknown_player'
    | 'invalid_path'
    | 'too_short'
    | 'not_a_word'
    | 'already_found';
}

export interface GameOverPayload {
  results: { userId: string; score: number; words: string[] }[];
}
