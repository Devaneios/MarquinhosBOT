import type { DiscordIdentity } from '../../../discordAuth.ts';
import { useGameSession } from '../../shared/useGameSession';

export function useMinesweeperSession(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  return useGameSession('minesweeper-versus', identity, 'multi', onAuthInvalid);
}
