import { useCallback, useEffect, useRef, useState } from 'react';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { devinfo, devlog, devwarn } from '../../lib/devlog';
import { errorMessage, isAuthError } from '../../lib/http';
import type { GameId } from '../gameId';
import { fetchWsSessionToken, type WsSession } from '../shared/activitySession';
import type { GameMode } from './types';

// 'checkers' is not yet in the shared GameId union — adding it there is the
// one-line wiring step called out in this game's brief, done once
// alongside the server/client registry entries. Cast locally so this game
// is otherwise self-contained until that lands.
const CHECKERS_GAME_ID = 'checkers' as GameId;

export type CheckersSessionState =
  | { status: 'selecting-mode' }
  | { status: 'connecting' }
  | { status: 'ready'; session: WsSession; mode: GameMode }
  | { status: 'error'; error: string };

export function useCheckersSession(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
): {
  session: CheckersSessionState;
  selectMode: (mode: GameMode) => void;
  backToMenu: () => void;
} {
  const [session, setSession] = useState<CheckersSessionState>({
    status: 'selecting-mode',
  });
  const cancelledRef = useRef(false);

  // Mirrors usePongSession: React 19 StrictMode double-invokes this effect
  // on mount, so resetting on (re)mount undoes the phantom first cleanup
  // that would otherwise permanently disable every future selectMode().
  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const selectMode = useCallback(
    (mode: GameMode) => {
      devlog('[checkers] selecting mode', mode);
      setSession({ status: 'connecting' });
      fetchWsSessionToken({
        game: CHECKERS_GAME_ID,
        mode,
        identity,
      })
        .then((session) => {
          if (cancelledRef.current) return;
          devinfo('[checkers] session ready', mode);
          setSession({ status: 'ready', session, mode });
        })
        .catch((err) => {
          console.error(
            'Failed to create Checkers session',
            JSON.stringify(err),
          );
          if (cancelledRef.current) return;
          if (isAuthError(err)) {
            devwarn('[checkers] session creation hit an auth error, reauthing');
            onAuthInvalid();
            return;
          }
          setSession({ status: 'error', error: errorMessage(err) });
        });
    },
    [identity, onAuthInvalid],
  );

  const backToMenu = useCallback(() => {
    devlog('[checkers] back to mode menu');
    setSession({ status: 'selecting-mode' });
  }, []);

  return { session, selectMode, backToMenu };
}
