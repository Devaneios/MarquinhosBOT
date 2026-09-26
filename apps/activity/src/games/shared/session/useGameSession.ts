import { errorMessage, isAuthError } from '@/platform/api/http';
import type { DiscordIdentity } from '@/platform/discord/auth';
import type { GameId } from '@marquinhos/contracts/activity/gameId';
import { useEffect, useEffectEvent, useState } from 'react';
import { fetchWsSessionToken, type WsSession } from './gameSession';

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
  const [result, setResult] = useState<{
    game: GameId;
    identity: DiscordIdentity;
    mode: 'single' | 'multi' | 'local' | null;
    state: GameSessionState;
  }>({
    game,
    identity,
    mode,
    state: { status: mode === null ? 'selecting-mode' : 'connecting' },
  });

  const notifyAuthInvalid = useEffectEvent(onAuthInvalid);

  useEffect(() => {
    if (mode === null) return;

    let cancelled = false;
    fetchWsSessionToken({ game, mode, identity })
      .then((session) => {
        if (!cancelled)
          setResult({
            game,
            identity,
            mode,
            state: { status: 'ready', session },
          });
      })
      .catch((err) => {
        if (cancelled) return;
        if (isAuthError(err)) {
          notifyAuthInvalid();
          return;
        }
        setResult({
          game,
          identity,
          mode,
          state: { status: 'error', error: errorMessage(err) },
        });
      });
    return () => {
      cancelled = true;
    };
  }, [game, identity, mode]);

  if (mode === null) return { status: 'selecting-mode' };
  return result.game === game &&
    result.identity === identity &&
    result.mode === mode
    ? result.state
    : { status: 'connecting' };
}
