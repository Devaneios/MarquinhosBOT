import type { DiscordIdentity } from '../../../hooks/useDiscordIdentity';
import { useGameSession } from '../../shared/useGameSession';

export function useMinesweeperSession(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  return useGameSession('minesweeper-versus', identity, 'multi', onAuthInvalid);
}
