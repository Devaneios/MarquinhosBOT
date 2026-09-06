import { describe, expect, it } from 'bun:test';
import { TriviaQuizEngine } from 'services/activity/trivia-quiz/TriviaQuizEngine';
import { getQuestions } from 'services/activity/trivia-quiz/questions';

describe('TriviaQuizEngine', () => {
  it('starts with no players and no active question', () => {
    const engine = new TriviaQuizEngine(getQuestions());
    const state = engine.getState();
    expect(state.players.size).toBe(0);
    expect(state.finished).toBe(false);
  });

  it('allows up to 8 players', () => {
    const engine = new TriviaQuizEngine(getQuestions());
    for (let i = 0; i < 8; i++) {
      engine.addPlayer(`user${i}`);
    }
    expect(engine.getState().players.size).toBe(8);
  });

  it('rejects adding a 9th player', () => {
    const engine = new TriviaQuizEngine(getQuestions());
    for (let i = 0; i < 8; i++) {
      engine.addPlayer(`user${i}`);
    }
    expect(() => engine.addPlayer('user9')).toThrow();
  });

  it('awards 1000 points for immediate correct answer', () => {
    const engine = new TriviaQuizEngine(getQuestions());
    engine.addPlayer('user1');
    engine.startGame();
    const state = engine.getState();
    const question = state.questions[0]!;

    engine.submitAnswer(
      'user1',
      question.correctIndex,
      state.questionStartedAtMs,
    );
    const player = engine.getState().players.get('user1')!;
    expect(player.totalScore).toBe(1000);
  });

  it('awards 500 points for correct answer at end of timer', () => {
    const engine = new TriviaQuizEngine(getQuestions());
    engine.addPlayer('user1');
    engine.startGame();
    const state = engine.getState();
    const question = state.questions[0]!;

    engine.submitAnswer(
      'user1',
      question.correctIndex,
      state.questionStartedAtMs + state.questionTimerMs,
    );
    const player = engine.getState().players.get('user1')!;
    expect(player.totalScore).toBe(500);
  });

  it('awards 0 points for wrong answer', () => {
    const engine = new TriviaQuizEngine(getQuestions());
    engine.addPlayer('user1');
    engine.startGame();
    const state = engine.getState();
    const question = state.questions[state.currentQuestionIndex];
    if (!question) throw new Error('Question not found');

    const wrongIndex = (question.correctIndex + 1) % question.options.length;
    engine.submitAnswer('user1', wrongIndex, state.questionStartedAtMs + 1000);
    const player = engine.getState().players.get('user1')!;
    expect(player.totalScore).toBe(0);
  });

  it('rejects late answers', () => {
    const engine = new TriviaQuizEngine(getQuestions());
    engine.addPlayer('user1');
    engine.startGame();
    const state = engine.getState();
    const question = state.questions[0]!;

    const result = engine.submitAnswer(
      'user1',
      question.correctIndex,
      state.questionStartedAtMs + state.questionTimerMs + 1,
    );
    expect(result).toBe(false);
  });

  it('rejects duplicate answers from same player', () => {
    const engine = new TriviaQuizEngine(getQuestions());
    engine.addPlayer('user1');
    engine.startGame();
    const state = engine.getState();
    const question = state.questions[0]!;

    engine.submitAnswer(
      'user1',
      question.correctIndex,
      state.questionStartedAtMs + 100,
    );
    const result = engine.submitAnswer(
      'user1',
      question.correctIndex,
      state.questionStartedAtMs + 200,
    );
    expect(result).toBe(false);
  });
});
