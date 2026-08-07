import React, { useEffect, useState } from 'react';
import type { TriviaQuizSessionState } from '../types';

interface QuestionScreenProps {
  state: TriviaQuizSessionState;
  onAnswer: (answerIndex: number) => void;
}

export const QuestionScreen: React.FC<QuestionScreenProps> = ({ state, onAnswer }) => {
  const [timeLeft, setTimeLeft] = useState(0);
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    if (!state.currentQuestion) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - state.currentQuestion!.startedAtMs;
      const remaining = Math.max(0, state.currentQuestion!.timerMs - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 0) {
        setAnswered(true);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [state.currentQuestion]);

  if (!state.currentQuestion) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="notch-8 flex min-h-[240px] w-full max-w-[520px] flex-col items-center justify-center gap-4 border border-marquinhos-border bg-marquinhos-panel px-8 py-10 text-center shadow-[0_20px_40px_rgba(0,0,0,0.24)]">
          <div className="font-pixel animate-pong-blink text-sm tracking-[0.28em] text-marquinhos-accent">
            LOADING QUESTION…
          </div>
        </div>
      </div>
    );
  }

  const percentage = (timeLeft / state.currentQuestion.timerMs) * 100;
  const timeSeconds = (timeLeft / 1000).toFixed(1);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="notch-8 w-full border border-marquinhos-border bg-marquinhos-panel px-6 py-5 shadow-[0_20px_40px_rgba(0,0,0,0.24)]">
        <h2 className="mb-4 text-lg font-semibold text-marquinhos-text">{state.currentQuestion.text}</h2>

        <div className="mb-4 space-y-2">
          <div className="flex justify-between text-xs text-marquinhos-text-dim">
            <span>Time</span>
            <span>{timeSeconds}s</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-sm bg-marquinhos-border">
            <div
              className="h-full transition-all duration-100"
              style={{
                width: `${percentage}%`,
                backgroundColor: percentage > 25 ? '#4CAF50' : '#FF9800',
              }}
            />
          </div>
        </div>

        <div className="space-y-2">
          {state.currentQuestion.options.map((option, index) => (
            <button
              key={index}
              onClick={() => {
                onAnswer(index);
                setAnswered(true);
              }}
              disabled={answered}
              className="notch-4 w-full border border-marquinhos-border bg-marquinhos-bg px-4 py-3 text-left text-sm text-marquinhos-text transition hover:border-marquinhos-border-hover hover:bg-marquinhos-panel disabled:cursor-not-allowed disabled:opacity-50"
            >
              {String.fromCharCode(65 + index)}.  {option}
            </button>
          ))}
        </div>
      </div>

      {state.playerScores.length > 0 && (
        <div className="notch-8 border border-marquinhos-border bg-marquinhos-panel px-6 py-5 shadow-[0_20px_40px_rgba(0,0,0,0.24)]">
          <h3 className="mb-3 font-semibold text-marquinhos-text">Scores</h3>
          <div className="space-y-2 text-sm">
            {state.playerScores.map((ps) => (
              <div key={ps.userId} className="flex justify-between text-marquinhos-text-dim">
                <span>{ps.userId}</span>
                <span className="font-semibold text-marquinhos-text">{ps.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
