import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { MenuScreen } from './components/MenuScreen';
import { QuestionScreen } from './components/QuestionScreen';
import { LeaderboardScreen } from './components/LeaderboardScreen';
import { useTriviaQuizSession } from './useTriviaQuizSession';

type Scene = 'menu' | 'game' | 'leaderboard' | 'error';

interface TriviaQuizGameProps {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
}

export const TriviaQuizGame: React.FC<TriviaQuizGameProps> = ({
  identity,
  onAuthInvalid,
}) => {
  const navigate = useNavigate();
  const [scene, setScene] = useState<Scene>('menu');
  const { sessionStatus, state, ready, submitAnswer } = useTriviaQuizSession(
    identity,
    onAuthInvalid,
  );

  const playerCount = useMemo(
    () => state.playerScores.length,
    [state.playerScores.length],
  );

  useEffect(() => {
    if (sessionStatus.status === 'error') {
      setScene('error');
    }
  }, [sessionStatus]);

  useEffect(() => {
    if (state.finished && scene === 'game') {
      setScene('leaderboard');
    }
  }, [state.finished, scene]);

  if (sessionStatus.status === 'connecting') {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="notch-8 flex min-h-[240px] w-full max-w-[520px] flex-col items-center justify-center gap-4 border border-marquinhos-border bg-marquinhos-panel px-8 py-10 text-center shadow-[0_20px_40px_rgba(0,0,0,0.24)]">
          <div className="font-pixel animate-pong-blink text-sm tracking-[0.28em] text-marquinhos-accent">
            STARTING GAME…
          </div>
          <div className="max-w-[36ch] text-sm leading-6 text-marquinhos-text-dim">
            Connecting to the trivia session...
          </div>
        </div>
      </div>
    );
  }

  if (scene === 'error') {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="notch-8 flex min-h-[240px] w-full max-w-[560px] flex-col items-center justify-center gap-5 border border-marquinhos-border bg-marquinhos-panel px-8 py-10 text-center shadow-[0_20px_40px_rgba(0,0,0,0.24)]">
          <div className="font-pixel text-lg tracking-[0.24em] text-marquinhos-danger">
            CONNECTION FAILED
          </div>
          <div className="max-w-[48ch] text-sm leading-6 text-marquinhos-text-dim">
            {sessionStatus.status === 'error' ? sessionStatus.error : 'An error occurred'}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              className="notch-6 border border-marquinhos-accent/60 bg-marquinhos-accent px-5 py-3 text-sm font-semibold text-black transition hover:bg-marquinhos-accent-hover"
              onClick={onAuthInvalid}
            >
              Retry auth
            </button>
            <button
              type="button"
              className="notch-6 border border-marquinhos-border bg-marquinhos-bg px-5 py-3 text-sm text-marquinhos-text transition hover:border-marquinhos-border-hover"
              onClick={() => navigate('/')}
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="notch-8 flex min-h-[240px] w-full max-w-[520px] flex-col items-center justify-center gap-4 border border-marquinhos-border bg-marquinhos-panel px-8 py-10 text-center shadow-[0_20px_40px_rgba(0,0,0,0.24)]">
          <div className="font-pixel animate-pong-blink text-sm tracking-[0.28em] text-marquinhos-accent">
            LOADING…
          </div>
        </div>
      </div>
    );
  }

  if (scene === 'menu') {
    return (
      <MenuScreen
        playerCount={playerCount}
        onReady={() => setScene('game')}
      />
    );
  }

  if (scene === 'leaderboard') {
    return <LeaderboardScreen leaderboard={state.leaderboard} />;
  }

  return <QuestionScreen state={state} onAnswer={submitAnswer} />;
};
