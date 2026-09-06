import { useCallback, useEffect, useRef, useState } from 'react';
import type { DiscordIdentity } from '../../../discordAuth.ts';
import { devinfo, devlog, devwarn } from '../../../lib/devlog';
import { errorMessage, isAuthError } from '../../../lib/http';
import {
  fetchWsSessionToken,
  type WsSession,
} from '../../shared/activitySession';
import type { GameMode } from '../types';

export type BingoSpeedSessionState =
  | { status: 'selecting-mode' }
  | { status: 'connecting' }
  | { status: 'ready'; session: WsSession; mode: GameMode }
  | { status: 'error'; error: string };

export function useBingoSpeedSession(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
): {
  session: BingoSpeedSessionState;
  selectMode: (mode: GameMode) => void;
  backToMenu: () => void;
} {
  const [session, setSession] = useState<BingoSpeedSessionState>({
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
      devlog('[bingo-speed] selecting mode', mode);
      setSession({ status: 'connecting' });
      fetchWsSessionToken({
        game: 'bingo-speed',
        mode,
        identity,
      })
        .then((session) => {
          if (cancelledRef.current) return;
          devinfo('[bingo-speed] session ready', mode);
          setSession({ status: 'ready', session, mode });
        })
        .catch((err) => {
          console.error(
            'Failed to create Bingo Speed session',
            JSON.stringify(err),
          );
          if (cancelledRef.current) return;
          if (isAuthError(err)) {
            devwarn(
              '[bingo-speed] session creation hit an auth error, reauthing',
            );
            onAuthInvalid();
            return;
          }
          setSession({ status: 'error', error: errorMessage(err) });
        });
    },
    [identity, onAuthInvalid],
  );

  const backToMenu = useCallback(() => {
    devlog('[bingo-speed] back to mode menu');
    setSession({ status: 'selecting-mode' });
  }, []);

  return { session, selectMode, backToMenu };
}
