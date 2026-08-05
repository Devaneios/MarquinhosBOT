import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { apiUrl } from '../../lib/apiBase';
import { postJson } from '../../lib/http';
import type { GameId } from '../gameId';

export interface WsSessionParams {
  game: GameId;
  mode: 'single' | 'multi' | 'local';
  identity: DiscordIdentity;
  extra?: Record<string, unknown>;
}

// Shared by every game's session hook: mints a game-scoped WS token from the
// player's Discord identity. Pong layers a menu-driven state machine on top
// of this (usePongSession); a game with no mode selection can call it
// directly.
export function fetchWsSessionToken({
  game,
  mode,
  identity,
  extra,
}: WsSessionParams): Promise<string> {
  return postJson<{ token: string }>(apiUrl('/activities/ws-session'), {
    accessToken: identity.accessToken,
    instanceId: identity.instanceId,
    guildId: identity.guildId,
    mode,
    game,
    ...extra,
  }).then(({ token }) => token);
}
