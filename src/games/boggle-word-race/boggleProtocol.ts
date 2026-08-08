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

export const SUBMIT_ERROR_MESSAGES: Record<SubmitErrorPayload['reason'], string> = {
  not_started: 'Game has not started yet',
  already_ended: "Time's up",
  unknown_player: 'Not part of this game',
  invalid_path: 'Letters must be adjacent and unused',
  too_short: 'Words need 3+ letters',
  not_a_word: 'Not a real word',
  already_found: 'You already found that word',
};
