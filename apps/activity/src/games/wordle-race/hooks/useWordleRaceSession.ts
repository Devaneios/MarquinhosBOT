import type { DiscordIdentity } from '@/discord/auth';
import { useGameSession } from '@/realtime/useGameSession';

export function useWordleRaceSession(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  return useGameSession('wordle-race', identity, 'multi', onAuthInvalid);
}
