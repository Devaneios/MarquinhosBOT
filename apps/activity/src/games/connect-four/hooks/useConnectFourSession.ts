import { useCallback, useEffect, useRef, useState } from 'react';
import type { DiscordIdentity } from '../../../discordAuth.ts';
import { errorMessage, isAuthError } from '../../../lib/http';
import {
  fetchWsSessionToken,
  type WsSession,
} from '../../shared/activitySession';
import type { GameMode } from '../types';

const GAME_ID = 'connect-four';

export type ConnectFourSessionState =
  | { status: 'selecting-mode' }
  | { status: 'connecting' }
  | { status: 'ready'; session: WsSession; mode: GameMode }
  | { status: 'error'; error: string };

export function useConnectFourSession(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
): {
  session: ConnectFourSessionState;
  selectMode: (mode: GameMode) => void;
  backToMenu: () => void;
} {
  const [session, setSession] = useState<ConnectFourSessionState>({
    status: 'selecting-mode',
  });
  const cancelledRef = useRef(false);

  // Mirrors usePongSession: StrictMode's mount->cleanup->mount double
  // invocation would otherwise leave cancelledRef stuck true after the
  // phantom first pass, silently dropping every later selectMode() result.
  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const selectMode = useCallback(
    (mode: GameMode) => {
      setSession({ status: 'connecting' });
      fetchWsSessionToken({ game: GAME_ID, mode, identity })
        .then((session) => {
          if (cancelledRef.current) return;
          setSession({ status: 'ready', session, mode });
        })
        .catch((err) => {
          if (cancelledRef.current) return;
          if (isAuthError(err)) {
            onAuthInvalid();
            return;
          }
          setSession({ status: 'error', error: errorMessage(err) });
        });
    },
    [identity, onAuthInvalid],
  );

  const backToMenu = useCallback(() => {
    setSession({ status: 'selecting-mode' });
  }, []);

  return { session, selectMode, backToMenu };
}
