import type { DiscordIdentity } from '../../../hooks/useDiscordIdentity';
import { useGameSession } from '../../shared/useGameSession';

export function useBattleshipSession(
  identity: DiscordIdentity,
  mode: 'single' | 'multi' | null,
  onAuthInvalid: () => void,
) {
  return useGameSession('battleship', identity, mode, onAuthInvalid);
}
