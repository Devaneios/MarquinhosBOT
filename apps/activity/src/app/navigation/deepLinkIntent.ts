import { apiBase } from '@/platform/api/apiBase';
import type { DiscordIdentity } from '@/platform/discord/auth';
import { fetchContract } from '@marquinhos/api-client/browser';
import type { GameId } from '@marquinhos/contracts/activity/gameId';
import * as activityApi from '@marquinhos/contracts/http/routes/activity';

export function fetchDeepLinkIntent(
  identity: DiscordIdentity,
): Promise<{ game: GameId | null }> {
  return fetchContract(apiBase(), activityApi.claimDeepLink, {
    body: { accessToken: identity.accessToken, guildId: identity.guildId },
  }).then((response) => response.data);
}
