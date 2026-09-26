import type { DiscordIdentity } from '@/discord/auth';
import { errorMessage, isAuthError } from '@/lib/http';
import { fetchWsSessionToken, type WsSession } from '@/realtime/gameSession';
import { useEffect, useEffectEvent, useState } from 'react';

type WordChainSessionState =
  | { status: 'selecting-mode' }
  | { status: 'connecting' }
  | { status: 'ready'; session: WsSession }
  | { status: 'error'; error: string };

export function useWordChainSession(
  identity: DiscordIdentity,
  mode: 'single' | 'multi' | null,
  onAuthInvalid: () => void,
): WordChainSessionState {
  const [result, setResult] = useState<{
    identity: DiscordIdentity;
    mode: 'single' | 'multi' | null;
    state: WordChainSessionState;
  }>({
    identity,
    mode,
    state: { status: mode ? 'connecting' : 'selecting-mode' },
  });

  const notifyAuthInvalid = useEffectEvent(onAuthInvalid);

  useEffect(() => {
    if (!mode) return;

    let cancelled = false;

    fetchWsSessionToken({ game: 'word-chain', mode, identity })
      .then((session) => {
        if (cancelled) return;
        setResult({ identity, mode, state: { status: 'ready', session } });
      })
      .catch((err) => {
        if (cancelled) return;
        if (isAuthError(err)) {
          notifyAuthInvalid();
          return;
        }
        setResult({
          identity,
          mode,
          state: { status: 'error', error: errorMessage(err) },
        });
      });

    return () => {
      cancelled = true;
    };
  }, [identity, mode]);

  if (!mode) return { status: 'selecting-mode' };
  return result.identity === identity && result.mode === mode
    ? result.state
    : { status: 'connecting' };
}
