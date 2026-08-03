import { useCallback, useEffect, useRef, useState } from 'react';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { apiUrl } from '../../lib/apiBase';
import { errorMessage, isAuthError, postJson } from '../../lib/http';
import type { BotDifficulty, GameMode, WinScore } from './types';

export type PongSessionState =
  | { status: 'selecting-mode' }
  | { status: 'connecting' }
  | { status: 'ready'; wsToken: string; mode: GameMode; sound: boolean }
  | { status: 'error'; error: string };

export function usePongSession(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
): {
  session: PongSessionState;
  selectMode: (
    mode: GameMode,
    difficulty: BotDifficulty,
    winScore: WinScore,
    sound: boolean,
  ) => void;
  backToMenu: () => void;
} {
  const [session, setSession] = useState<PongSessionState>({
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
    (
      mode: GameMode,
      difficulty: BotDifficulty,
      winScore: WinScore,
      sound: boolean,
    ) => {
      console.log('[pong] selecting mode', mode, difficulty, winScore);
      setSession({ status: 'connecting' });
      postJson<{ token: string }>(apiUrl('/activities/ws-session'), {
        accessToken: identity.accessToken,
        instanceId: identity.instanceId,
        guildId: identity.guildId,
        mode,
        game: 'pong',
        winningScore: winScore,
        ...(mode === 'single' ? { difficulty } : {}),
      })
        .then(({ token }) => {
          if (cancelledRef.current) return;
          console.info('[pong] session ready', mode);
          setSession({ status: 'ready', wsToken: token, mode, sound });
        })
        .catch((err) => {
          console.error('Failed to create Pong session', JSON.stringify(err));
          if (cancelledRef.current) return;
          if (isAuthError(err)) {
            console.warn(
              '[pong] session creation hit an auth error, reauthing',
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
    console.log('[pong] back to mode menu');
    setSession({ status: 'selecting-mode' });
  }, []);

  return { session, selectMode, backToMenu };
}
