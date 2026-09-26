import { apiBase } from '@/platform/api/apiBase';
import type { DiscordIdentity } from '@/platform/discord/auth';
import { fetchContract } from '@marquinhos/api-client/browser';
import type { GameId } from '@marquinhos/contracts/activity/gameId';
import type { WsSession } from '@marquinhos/contracts/http/routes/activity';
import * as activityApi from '@marquinhos/contracts/http/routes/activity';

export type { WsSession };

export interface WsSessionParams {
  game: GameId;
  mode: 'single' | 'multi' | 'local';
  identity: DiscordIdentity;
  extra?: Record<string, unknown>;
}

// Shared by every game's session hook: mints a game-scoped WS token (and its
// matching Colyseus roomKey) from the player's Discord identity. Pong layers
// a menu-driven state machine on top of this (usePongSession); a game with
// no mode selection can call it directly.
export function fetchWsSessionToken({
  game,
  mode,
  identity,
  extra,
}: WsSessionParams): Promise<WsSession> {
  return fetchContract(apiBase(), activityApi.wsSession, {
    body: {
      accessToken: identity.accessToken,
      instanceId: identity.instanceId,
      guildId: identity.guildId,
      mode,
      game,
      ...extra,
    },
  }).then((response) => response.data);
}
