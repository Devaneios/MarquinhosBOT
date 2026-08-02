import { useCallback, useEffect, useRef, useState } from 'react';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { apiUrl } from '../../lib/apiBase';
import { errorMessage, isAuthError, postJson } from '../../lib/http';
import type { GameMode } from './types';

export type PongSessionState =
  | { status: 'selecting-mode' }
  | { status: 'connecting' }
  | { status: 'ready'; wsToken: string; mode: GameMode }
  | { status: 'error'; error: string };

export function usePongSession(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
): {
  session: PongSessionState;
  selectMode: (mode: GameMode) => void;
  backToMenu: () => void;
} {
  const [session, setSession] = useState<PongSessionState>({
    status: 'selecting-mode',
  });
  const cancelledRef = useRef(false);

  useEffect(
    () => () => {
      cancelledRef.current = true;
    },
    [],
  );

  const selectMode = useCallback(
    (mode: GameMode) => {
      setSession({ status: 'connecting' });
      postJson<{ token: string }>(apiUrl('/activities/ws-session'), {
        accessToken: identity.accessToken,
        instanceId: identity.instanceId,
        guildId: identity.guildId,
        mode,
        game: 'pong',
      })
        .then(({ token }) => {
          if (cancelledRef.current) return;
          setSession({ status: 'ready', wsToken: token, mode });
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
