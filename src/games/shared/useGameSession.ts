import { useEffect, useState } from 'react';
import type { DiscordIdentity } from '../../discordAuth.ts';
import { errorMessage, isAuthError } from '../../lib/http';
import type { GameId } from '../gameId';
import { fetchWsSessionToken, type WsSession } from './activitySession';

export type GameSessionState =
  | { status: 'selecting-mode' }
  | { status: 'connecting' }
  | { status: 'ready'; session: WsSession }
  | { status: 'error'; error: string };

export function useGameSession(
  game: GameId,
  identity: DiscordIdentity,
  mode: 'single' | 'multi' | 'local',
  onAuthInvalid: () => void,
): Exclude<GameSessionState, { status: 'selecting-mode' }>;
export function useGameSession(
  game: GameId,
  identity: DiscordIdentity,
  mode: 'single' | 'multi' | 'local' | null,
  onAuthInvalid: () => void,
): GameSessionState;
export function useGameSession(
  game: GameId,
  identity: DiscordIdentity,
  mode: 'single' | 'multi' | 'local' | null,
  onAuthInvalid: () => void,
): GameSessionState {
  const [state, setState] = useState<GameSessionState>({
    status: 'connecting',
  });

  useEffect(() => {
    if (mode === null) {
      setState({ status: 'selecting-mode' });
      return;
    }

    let cancelled = false;
    setState({ status: 'connecting' });
    fetchWsSessionToken({ game, mode, identity })
      .then((session) => {
        if (!cancelled) setState({ status: 'ready', session });
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
  }, [game, identity, mode, onAuthInvalid]);

  return state;
}
