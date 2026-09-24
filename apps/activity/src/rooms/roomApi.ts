import { fetchContract } from '@marquinhos/api-client/browser';
import type { GameId } from '@marquinhos/contracts/activity/gameId';
import type {
  CreatedRoom,
  RoomListing,
} from '@marquinhos/contracts/http/routes/activity';
import * as activityApi from '@marquinhos/contracts/http/routes/activity';
import type { DiscordIdentity } from '../discord/auth.ts';
import { apiBase } from '../lib/apiBase';

export type { CreatedRoom, RoomListing };

export function createRoom({
  game,
  identity,
  queueEnabled,
}: {
  game: GameId;
  identity: DiscordIdentity;
  queueEnabled: boolean;
}): Promise<CreatedRoom> {
  return fetchContract(apiBase(), activityApi.createRoom, {
    body: {
      accessToken: identity.accessToken,
      instanceId: identity.instanceId,
      guildId: identity.guildId,
      game,
      queueEnabled,
    },
  }).then((response) => response.data);
}

export function getAvailableRooms(
  identity: DiscordIdentity,
): Promise<RoomListing[]> {
  return fetchContract(apiBase(), activityApi.listRooms, {
    body: {
      accessToken: identity.accessToken,
      instanceId: identity.instanceId,
      guildId: identity.guildId,
    },
  }).then((response) => response.data);
}
