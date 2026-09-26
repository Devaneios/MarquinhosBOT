import { useGameSession } from '@/games/shared/session/useGameSession';
import type { DiscordIdentity } from '@/platform/discord/auth';

export function useWordleRaceSession(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  return useGameSession('wordle-race', identity, 'multi', onAuthInvalid);
}
