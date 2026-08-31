import type { DiscordIdentity } from '../../../hooks/useDiscordIdentity';
import { useGameSession } from '../../shared/useGameSession';

export function useWordleRaceSession(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  return useGameSession('wordle-race', identity, 'multi', onAuthInvalid);
}
