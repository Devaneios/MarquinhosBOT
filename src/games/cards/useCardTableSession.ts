import { useEffect, useState } from 'react';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { errorMessage, isAuthError } from '../../lib/http';
import { fetchWsSessionToken, type WsSession } from '../shared/activitySession';

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
  const [state, setState] = useState<CardTableSessionState>({
    status: 'connecting',
  });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'connecting' });
    fetchWsSessionToken({
      game: 'cards',
      mode: 'multi',
      identity,
      extra: { ruleset },
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
  }, [identity, ruleset, onAuthInvalid]);

  return state;
}
