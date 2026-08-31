import type { DiscordIdentity } from '../../../hooks/useDiscordIdentity';
import { useGameSession } from '../../shared/useGameSession';

export function useWordSearchRaceSession(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  return useGameSession('word-search-race', identity, 'multi', onAuthInvalid);
}
