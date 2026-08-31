import { useCallback, useEffect, useRef, useState } from 'react';
import type { DiscordIdentity } from '../../../hooks/useDiscordIdentity';
import { devinfo, devlog, devwarn } from '../../../lib/devlog';
import { errorMessage, isAuthError } from '../../../lib/http';
import {
  fetchWsSessionToken,
  type WsSession,
} from '../../shared/activitySession';

export type SnakeMode = 'single' | 'multi';

export type SnakeSessionState =
  | { status: 'selecting-mode' }
  | { status: 'connecting' }
  | { status: 'ready'; session: WsSession; mode: SnakeMode }
  | { status: 'error'; error: string };

export function useSnakeSession(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
): {
  session: SnakeSessionState;
  selectMode: (mode: SnakeMode) => void;
  backToMenu: () => void;
} {
  const [session, setSession] = useState<SnakeSessionState>({
    status: 'selecting-mode',
  });
  const cancelledRef = useRef(false);

  // StrictMode double-invokes this effect on mount (mount -> cleanup ->
  // mount), so the cleanup alone would permanently flip cancelledRef to
  // true after the phantom first pass, silently dropping every future
  // selectMode() result. Resetting on (re)mount undoes that.
  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const selectMode = useCallback(
    (mode: SnakeMode) => {
      devlog('[snake] selecting mode', mode);
      setSession({ status: 'connecting' });
      fetchWsSessionToken({ game: 'snake-game', mode, identity })
        .then((session) => {
          if (cancelledRef.current) return;
          devinfo('[snake] session ready', mode);
          setSession({ status: 'ready', session, mode });
        })
        .catch((err) => {
          console.error('Failed to create Snake session', JSON.stringify(err));
          if (cancelledRef.current) return;
          if (isAuthError(err)) {
            devwarn('[snake] session creation hit an auth error, reauthing');
            onAuthInvalid();
            return;
          }
          setSession({ status: 'error', error: errorMessage(err) });
        });
    },
    [identity, onAuthInvalid],
  );

  const backToMenu = useCallback(() => {
    devlog('[snake] back to mode menu');
    setSession({ status: 'selecting-mode' });
  }, []);

  return { session, selectMode, backToMenu };
}
