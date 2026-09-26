import { fetchWsSessionToken } from '@/games/shared/session/gameSession';
import { errorMessage, isAuthError } from '@/platform/api/http';
import type { DiscordIdentity } from '@/platform/discord/auth';
import { useEffect, useEffectEvent, useState } from 'react';
import type { WordleSessionState } from '../types';

export function useWordleSession(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
): WordleSessionState {
  const [result, setResult] = useState<{
    identity: DiscordIdentity;
    state: WordleSessionState;
  }>({
    identity,
    state: { status: 'connecting' },
  });

  const notifyAuthInvalid = useEffectEvent(onAuthInvalid);

  useEffect(() => {
    let cancelled = false;
    fetchWsSessionToken({ game: 'wordle', mode: 'single', identity })
      .then((session) => {
        if (cancelled) return;
        setResult({ identity, state: { status: 'ready', session } });
      })
      .catch((err) => {
        if (cancelled) return;
        if (isAuthError(err)) {
          notifyAuthInvalid();
          return;
        }
        setResult({
          identity,
          state: { status: 'error', error: errorMessage(err) },
        });
      });
    return () => {
      cancelled = true;
    };
  }, [identity]);

  return result.identity === identity ? result.state : { status: 'connecting' };
}
