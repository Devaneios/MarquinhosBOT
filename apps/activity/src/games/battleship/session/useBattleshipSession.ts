import { useGameSession } from '@/games/shared/session/useGameSession';
import type { DiscordIdentity } from '@/platform/discord/auth';

export function useBattleshipSession(
  identity: DiscordIdentity,
  mode: 'single' | 'multi' | null,
  onAuthInvalid: () => void,
) {
  return useGameSession('battleship', identity, mode, onAuthInvalid);
}
