import type { DiscordIdentity } from '../../../discord/auth.ts';
import { useGameSession } from '../../../realtime/useGameSession';

export function useBattleshipSession(
  identity: DiscordIdentity,
  mode: 'single' | 'multi' | null,
  onAuthInvalid: () => void,
) {
  return useGameSession('battleship', identity, mode, onAuthInvalid);
}
