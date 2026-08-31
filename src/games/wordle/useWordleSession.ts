import { useEffect, useState } from 'react';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { errorMessage, isAuthError } from '../../lib/http';
import { fetchWsSessionToken } from '../shared/activitySession';
import type { WordleSessionState } from './types';

export function useWordleSession(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
): WordleSessionState {
  const [state, setState] = useState<WordleSessionState>({
    status: 'connecting',
  });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'connecting' });
    fetchWsSessionToken({ game: 'wordle', mode: 'single', identity })
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
