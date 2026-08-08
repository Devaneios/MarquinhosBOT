import { useEffect, useState } from 'react';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { errorMessage, isAuthError } from '../../lib/http';
import {
  fetchWsSessionToken,
  type WsSession,
} from '../shared/activitySession';

type WordChainSessionState =
  | { status: 'connecting' }
  | { status: 'ready'; session: WsSession }
  | { status: 'error'; error: string };

export function useWordChainSession(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
): WordChainSessionState {
  const [state, setState] = useState<WordChainSessionState>({
    status: 'connecting',
  });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'connecting' });

    fetchWsSessionToken({ game: 'word-chain', mode: 'multi', identity })
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
  }, [identity, onAuthInvalid]);

  return state;
}
