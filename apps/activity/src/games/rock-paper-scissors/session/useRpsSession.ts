import {
  fetchWsSessionToken,
  type WsSession,
} from '@/games/shared/session/gameSession';
import { errorMessage, isAuthError } from '@/platform/api/http';
import type { DiscordIdentity } from '@/platform/discord/auth';
import { useEffect, useEffectEvent, useState } from 'react';

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
  const [result, setResult] = useState<{
    identity: DiscordIdentity;
    mode: 'single' | 'multi' | null;
    state: RpsSessionState;
  }>({
    identity,
    mode,
    state: { status: mode ? 'connecting' : 'selecting-mode' },
  });

  const notifyAuthInvalid = useEffectEvent(onAuthInvalid);

  useEffect(() => {
    if (!mode) return;

    let cancelled = false;
    fetchWsSessionToken({
      game: 'rock-paper-scissors',
      mode,
      identity,
    })
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
