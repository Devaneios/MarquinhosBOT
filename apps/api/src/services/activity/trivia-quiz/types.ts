export interface Question {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  category: string;
}

export interface PlayerAnswer {
  userId: string;
  answerIndex: number;
  submittedAtMs: number;
  questionId: string;
}

export interface PlayerScore {
  userId: string;
  totalScore: number;
  correctCount: number;
  answers: Map<string, { correct: boolean; points: number }>;
}

export interface TriviaQuizState {
  currentQuestionIndex: number;
  questions: readonly Question[];
  players: Map<string, PlayerScore>;
  playerAnswers: Map<string, PlayerAnswer>;
  gameStartedAtMs: number;
  questionStartedAtMs: number;
  questionTimerMs: number;
  finished: boolean;
}
