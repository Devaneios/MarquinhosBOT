import type {
  Question,
  TriviaQuizState,
} from 'services/activity/trivia-quiz/types';

export class TriviaQuizEngine {
  private readonly state: TriviaQuizState;

  constructor(questions: readonly Question[]) {
    this.state = {
      currentQuestionIndex: -1,
      questions,
      players: new Map(),
      playerAnswers: new Map(),
      gameStartedAtMs: 0,
      questionStartedAtMs: 0,
      questionTimerMs: 15000,
      finished: false,
    };
  }

  getState(): TriviaQuizState {
    return this.state;
  }

  addPlayer(userId: string): void {
    if (this.state.players.size >= 8) {
      throw new Error('Maximum 8 players allowed');
    }
    if (this.state.players.has(userId)) {
      return;
    }
    this.state.players.set(userId, {
      userId,
      totalScore: 0,
      correctCount: 0,
      answers: new Map(),
    });
  }

  startGame(): void {
    this.state.gameStartedAtMs = Date.now();
    this.advanceQuestion();
  }

  tick(_elapsedMs: number): { questionEnded: boolean } {
    if (
      Date.now() - this.state.questionStartedAtMs >=
      this.state.questionTimerMs
    ) {
      return { questionEnded: true };
    }
    return { questionEnded: false };
  }

  submitAnswer(
    userId: string,
    answerIndex: number,
    submittedAtMs: number,
  ): boolean {
    const question = this.state.questions[this.state.currentQuestionIndex]!;
    const questionId = question.id;

    if (!this.state.players.has(userId)) return false;
    if (this.state.playerAnswers.has(userId)) return false;
    if (answerIndex < 0 || answerIndex >= question.options.length) return false;
    if (
      submittedAtMs >
      this.state.questionStartedAtMs + this.state.questionTimerMs
    )
      return false;

    this.state.playerAnswers.set(userId, {
      userId,
      answerIndex,
      submittedAtMs,
      questionId,
    });

    const isCorrect = answerIndex === question.correctIndex;
    const timeElapsedMs = submittedAtMs - this.state.questionStartedAtMs;
    const points = isCorrect
      ? Math.max(
          500,
          Math.round(1000 * (1 - timeElapsedMs / this.state.questionTimerMs)),
        )
      : 0;

    const player = this.state.players.get(userId)!;
    player.totalScore += points;
    if (isCorrect) player.correctCount += 1;
    player.answers.set(questionId, { correct: isCorrect, points });

    return true;
  }

  advanceQuestion(): boolean {
    this.state.currentQuestionIndex += 1;
    if (this.state.currentQuestionIndex >= this.state.questions.length) {
      this.state.finished = true;
      return false;
    }
    this.state.playerAnswers.clear();
    this.state.questionStartedAtMs = Date.now();
    return true;
  }

  getLeaderboard(): { userId: string; score: number }[] {
    return Array.from(this.state.players.values())
      .map((p) => ({ userId: p.userId, score: p.totalScore }))
      .sort((a, b) => b.score - a.score);
  }
}
