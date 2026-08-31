export type LetterFeedback = 'correct' | 'present' | 'absent';

export interface GuessRow {
  guess: string;
  feedback: LetterFeedback[];
}

export interface PlayerState {
  userId: string;
  attempts: number;
  solved: boolean;
  exhausted: boolean;
  guesses: GuessRow[];
}

export interface GameState {
  targetWordLength: number;
  maxAttempts: number;
  players: PlayerState[];
  firstSolver: string | null;
  gameOver: boolean;
  currentPlayerGuesses: GuessRow[];
  currentPlayerSolved: boolean;
  currentPlayerExhausted: boolean;
}
