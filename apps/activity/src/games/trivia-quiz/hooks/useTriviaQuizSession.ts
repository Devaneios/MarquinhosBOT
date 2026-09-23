import { useCallback, useEffect, useRef, useState } from 'react';
import type { DiscordIdentity } from '../../../discordAuth.ts';
import { colyseusUrl } from '../../../lib/apiBase';
import { errorMessage, isAuthError } from '../../../lib/http';
import {
  fetchWsSessionToken,
  type WsSession,
} from '../../shared/activitySession';
import { parsePayload } from '../../shared/colyseusConnection';
import {
  useColyseusRoom,
  type ActivityMessage,
} from '../../shared/useColyseusRoom';
import {
  gameEndPayloadSchema,
  initPayloadSchema,
  stateUpdatePayloadSchema,
  type TriviaQuizSessionState,
} from '../types';

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
    if (message.type === 'init') {
      const payload = parsePayload(initPayloadSchema, message);
      if (!payload) return;
      setState((prev) => ({
        ...prev,
        playerScores: payload.playerScores,
      }));
    } else if (message.type === 'state_update') {
      const payload = parsePayload(stateUpdatePayloadSchema, message);
      if (!payload) return;
      setState({
        currentQuestion: {
          text: payload.questionText,
          options: payload.options,
          startedAtMs: payload.questionStartedAtMs,
          timerMs: payload.questionTimerMs,
        },
        playerScores: payload.playerScores,
        finished: payload.finished,
        leaderboard: [],
      });
    } else if (message.type === 'game_end') {
      const payload = parsePayload(gameEndPayloadSchema, message);
      if (!payload) return;
      setState((prev) => ({
        ...prev,
        finished: true,
        leaderboard: payload.leaderboard,
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
