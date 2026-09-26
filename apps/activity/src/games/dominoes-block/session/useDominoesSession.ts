import { useGameSession } from '@/games/shared/session/useGameSession';
import type { DiscordIdentity } from '@/platform/discord/auth';

export function useDominoesSession(
  identity: DiscordIdentity,
  mode: 'single' | 'multi' | null,
  onAuthInvalid: () => void,
) {
  return useGameSession('dominoes-block', identity, mode, onAuthInvalid);
}
