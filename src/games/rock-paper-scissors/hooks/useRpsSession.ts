import { useEffect, useState } from 'react';
import type { DiscordIdentity } from '../../../hooks/useDiscordIdentity';
import { errorMessage, isAuthError } from '../../../lib/http';
import {
  fetchWsSessionToken,
  type WsSession,
} from '../../shared/activitySession';

type RpsSessionState =
  | { status: 'selecting-mode' }
  | { status: 'connecting' }
  | { status: 'ready'; session: WsSession }
  | { status: 'error'; error: string };

export function useRpsSession(
  identity: DiscordIdentity,
  mode: 'single' | 'multi' | null,
  onAuthInvalid: () => void,
): RpsSessionState {
  const [state, setState] = useState<RpsSessionState>({
    status: mode ? 'connecting' : 'selecting-mode',
  });

  useEffect(() => {
    if (!mode) {
      setState({ status: 'selecting-mode' });
      return;
    }

    let cancelled = false;
    setState({ status: 'connecting' });
    fetchWsSessionToken({
      game: 'rock-paper-scissors',
      mode,
      identity,
    })
      .then((session) => {
        if (cancelled) return;
        setState({ status: 'ready', session });
      })
      .catch((err) => {
        if (cancelled) return;
        if (isAuthError(err)) {
          onAuthInvalid();
          return;
        }
        setState({ status: 'error', error: errorMessage(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [identity, mode, onAuthInvalid]);

  return state;
}
