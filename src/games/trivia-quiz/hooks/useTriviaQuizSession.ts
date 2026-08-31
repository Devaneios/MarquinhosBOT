import { useCallback, useEffect, useRef, useState } from 'react';
import type { DiscordIdentity } from '../../../hooks/useDiscordIdentity';
import { colyseusUrl } from '../../../lib/apiBase';
import { errorMessage, isAuthError } from '../../../lib/http';
import {
  fetchWsSessionToken,
  type WsSession,
} from '../../shared/activitySession';
import {
  useColyseusRoom,
  type ActivityMessage,
} from '../../shared/useColyseusRoom';
import type { TriviaQuizMessage, TriviaQuizSessionState } from '../types';

type TriviaQuizSessionStatus =
  | { status: 'connecting' }
  | { status: 'ready'; session: WsSession }
  | { status: 'error'; error: string };

export function useTriviaQuizSession(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  const [sessionStatus, setSessionStatus] = useState<TriviaQuizSessionStatus>({
    status: 'connecting',
  });

  const [state, setState] = useState<TriviaQuizSessionState>({
    currentQuestion: null,
    playerScores: [],
    finished: false,
    leaderboard: [],
  });

  const [ready, setReady] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    setSessionStatus({ status: 'connecting' });
    fetchWsSessionToken({ game: 'trivia-quiz', mode: 'multi', identity })
      .then((session) => {
        if (cancelledRef.current) return;
        setSessionStatus({ status: 'ready', session });
      })
      .catch((err) => {
        if (cancelledRef.current) return;
        if (isAuthError(err)) {
          onAuthInvalid();
          return;
        }
        setSessionStatus({ status: 'error', error: errorMessage(err) });
      });

    return () => {
      cancelledRef.current = true;
    };
  }, [identity, onAuthInvalid]);

  const handleMessage = useCallback((message: ActivityMessage) => {
    const msg = message as TriviaQuizMessage;
    if (msg.type === 'init') {
      setState((prev) => ({
        ...prev,
        playerScores: msg.payload.playerScores,
      }));
    } else if (msg.type === 'state_update') {
      setState({
        currentQuestion: {
          text: msg.payload.questionText,
          options: msg.payload.options,
          startedAtMs: msg.payload.questionStartedAtMs,
          timerMs: msg.payload.questionTimerMs,
        },
        playerScores: msg.payload.playerScores,
        finished: msg.payload.finished,
        leaderboard: [],
      });
    } else if (msg.type === 'game_end') {
      setState((prev) => ({
        ...prev,
        finished: true,
        leaderboard: msg.payload.leaderboard,
      }));
    }
  }, []);

  const { send: sendMessage, connectionState } = useColyseusRoom(
    'trivia-quiz',
    sessionStatus.status === 'ready' ? sessionStatus.session : null,
    colyseusUrl(),
    handleMessage,
  );

  useEffect(() => {
    if (connectionState === 'connected') {
      setReady(true);
    }
  }, [connectionState]);

  const submitAnswer = useCallback(
    (answerIndex: number) => {
      sendMessage({ type: 'answer', payload: { answerIndex } });
    },
    [sendMessage],
  );

  return {
    sessionStatus,
    state,
    ready,
    submitAnswer,
  };
}
