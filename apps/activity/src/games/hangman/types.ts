export interface HangmanState {
  revealedWord: string;
  guessedLetters: string[];
  strikes: number;
  maxStrikes: number;
  gameOver: boolean;
  won: boolean;
}

export interface GuessErrorPayload {
  message: string;
}
