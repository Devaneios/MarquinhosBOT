export interface Question {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  category: string;
}

export interface PlayerScore {
  userId: string;
  score: number;
}

export interface StateUpdate {
  type: 'state_update';
  payload: {
    currentQuestionIndex: number;
    questionText: string;
    options: string[];
    questionStartedAtMs: number;
    questionTimerMs: number;
    playerScores: PlayerScore[];
    finished: boolean;
  };
}

export interface GameEnd {
  type: 'game_end';
  payload: {
    leaderboard: PlayerScore[];
  };
}

export interface Init {
  type: 'init';
  payload: {
    playerScores: PlayerScore[];
  };
}

export type TriviaQuizMessage = StateUpdate | GameEnd | Init;

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
