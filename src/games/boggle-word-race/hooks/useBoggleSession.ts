import type { DiscordIdentity } from '../../../hooks/useDiscordIdentity';
import { useGameSession } from '../../shared/useGameSession';

export function useBoggleSession(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  return useGameSession('boggle-word-race', identity, 'multi', onAuthInvalid);
}
