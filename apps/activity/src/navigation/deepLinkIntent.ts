import { fetchContract } from '@marquinhos/api-client/browser';
import type { GameId } from '@marquinhos/contracts/activity/gameId';
import * as activityApi from '@marquinhos/contracts/http/routes/activity';
import type { DiscordIdentity } from '../discord/auth.ts';
import { apiBase } from '../lib/apiBase';

export function fetchDeepLinkIntent(
  identity: DiscordIdentity,
): Promise<{ game: GameId | null }> {
  return fetchContract(apiBase(), activityApi.claimDeepLink, {
    body: { accessToken: identity.accessToken, guildId: identity.guildId },
  }).then((response) => response.data);
}
