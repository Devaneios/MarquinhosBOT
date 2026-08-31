import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConnectingScreen, ErrorScreen } from '../../components/game-shell';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { LeaderboardScreen } from './components/LeaderboardScreen';
import { MenuScreen } from './components/MenuScreen';
import { QuestionScreen } from './components/QuestionScreen';
import { useTriviaQuizSession } from './hooks/useTriviaQuizSession';

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
      <ConnectingScreen
        subtitleKey="connectingSubtitle"
        subtitleNs="trivia-quiz"
      />
    );
  }

  if (scene === 'error') {
    return (
      <ErrorScreen
        message={sessionStatus.status === 'error' ? sessionStatus.error : ''}
        onRetryAuth={onAuthInvalid}
        onBack={() => navigate('/')}
      />
    );
  }

  if (!ready) {
    return <ConnectingScreen />;
  }

  if (scene === 'menu') {
    return (
      <MenuScreen
        playerCount={playerCount}
        onReady={() => setScene('game')}
        onExit={() => navigate('/')}
      />
    );
  }

  if (scene === 'leaderboard') {
    return <LeaderboardScreen leaderboard={state.leaderboard} />;
  }

  return (
    <QuestionScreen
      state={state}
      onAnswer={submitAnswer}
      onExit={() => navigate('/')}
    />
  );
};
