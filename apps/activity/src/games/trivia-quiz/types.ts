import type { PlayerScore } from '@marquinhos/contracts/activity/games/triviaQuiz';

export interface TriviaQuizSessionState {
  currentQuestion: {
    text: string;
    options: string[];
    startedAtMs: number;
    timerMs: number;
  } | null;
  playerScores: PlayerScore[];
  finished: boolean;
  leaderboard: PlayerScore[];
}
