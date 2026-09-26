import {
  fetchWsSessionToken,
  type WsSession,
} from '@/games/shared/session/gameSession';
import { errorMessage, isAuthError } from '@/platform/api/http';
import type { DiscordIdentity } from '@/platform/discord/auth';
import { useEffect, useEffectEvent, useState } from 'react';

export type CardTableSessionState =
  | { status: 'connecting' }
  | { status: 'ready'; session: WsSession }
  | { status: 'error'; error: string };

// A card table is always a real multi-seat match (Truco needs 4 distinct
// humans, not a bot or hot-seat opponent), so — like Wordle's solo puzzle —
// there's no mode menu: this connects immediately once a ruleset is known.
export function useCardTableSession(
  identity: DiscordIdentity,
  ruleset: string,
  onAuthInvalid: () => void,
): CardTableSessionState {
  const [result, setResult] = useState<{
    identity: DiscordIdentity;
    ruleset: string;
    state: CardTableSessionState;
  }>({
    identity,
    ruleset,
    state: { status: 'connecting' },
  });

  const notifyAuthInvalid = useEffectEvent(onAuthInvalid);

  useEffect(() => {
    let cancelled = false;
    fetchWsSessionToken({
      game: 'cards',
      mode: 'multi',
      identity,
      extra: { ruleset },
    })
      .then((session) => {
        if (cancelled) return;
        setResult({ identity, ruleset, state: { status: 'ready', session } });
      })
      .catch((err) => {
        if (cancelled) return;
        if (isAuthError(err)) {
          notifyAuthInvalid();
          return;
        }
        setResult({
          identity,
          ruleset,
          state: { status: 'error', error: errorMessage(err) },
        });
      });
    return () => {
      cancelled = true;
    };
  }, [identity, ruleset]);

  return result.identity === identity && result.ruleset === ruleset
    ? result.state
    : { status: 'connecting' };
}
