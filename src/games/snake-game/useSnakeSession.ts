import { useCallback, useState } from 'react';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { devlog } from '../../lib/devlog';
import { colyseusUrl } from '../../lib/apiBase';
import { errorMessage, isAuthError } from '../../lib/http';
import {
  fetchWsSessionToken,
  type WsSession,
} from '../shared/activitySession';
import {
  useColyseusRoom,
  type ActivityMessage,
} from '../shared/useColyseusRoom';
import type { SnakeGameState } from './types';

export interface SnakeSessionState {
  status: 'selecting-mode' | 'connecting' | 'ready' | 'error';
  session?: WsSession;
  playerId?: string | null;
  gameState?: SnakeGameState | null;
  error?: string;
}

export function useSnakeSession(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  const [sessionState, setSessionState] = useState<SnakeSessionState>({
    status: 'selecting-mode',
  });

  const handleMessage = useCallback((message: ActivityMessage) => {
    if (message.type === 'init') {
      const init = message.payload as any;
      setSessionState((prev) => ({
        ...prev,
        playerId: init.playerId,
      }));
    } else if (message.type === 'state') {
      const state = message.payload as any;
      setSessionState((prev) => ({
        ...prev,
        gameState: state.state,
      }));
    }
  }, []);

  const { send, connectionState } = useColyseusRoom(
    'snake-game' as unknown as any,
    sessionState.status === 'ready' && sessionState.session
      ? sessionState.session
      : null,
    colyseusUrl(),
    handleMessage,
    (room) => {
      room.send('leave', {});
    },
  );

  const selectMode = useCallback(
    (mode: 'single' | 'multi') => {
      devlog('[snake] selecting mode', mode);
      setSessionState({ status: 'connecting' });
      fetchWsSessionToken({
        game: 'snake-game' as unknown as any,
        mode,
        identity,
      })
        .then((session) => {
          devlog('[snake] session ready', mode);
          setSessionState({
            status: 'ready',
            session,
            playerId: null,
            gameState: null,
          });
        })
        .catch((err) => {
          console.error('Failed to create Snake session', JSON.stringify(err));
          if (isAuthError(err)) {
            onAuthInvalid();
            return;
          }
          setSessionState({ status: 'error', error: errorMessage(err) });
        });
    },
    [identity, onAuthInvalid],
  );

  const backToMenu = useCallback(() => {
    devlog('[snake] back to mode menu');
    setSessionState({ status: 'selecting-mode' });
  }, []);

  const sendDirection = useCallback(
    (direction: string) => {
      send({ type: 'input', payload: { direction } });
    },
    [send],
  );

  const leave = useCallback(() => {
    send({ type: 'leave' });
    backToMenu();
  }, [send, backToMenu]);

  return {
    sessionState,
    selectMode,
    backToMenu,
    send,
    sendDirection,
    leave,
    connectionState,
  };
}
