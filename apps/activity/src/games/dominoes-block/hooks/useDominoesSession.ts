import type { DiscordIdentity } from '../../../discord/auth.ts';
import { useGameSession } from '../../../realtime/useGameSession';

export function useDominoesSession(
  identity: DiscordIdentity,
  mode: 'single' | 'multi' | null,
  onAuthInvalid: () => void,
) {
  return useGameSession('dominoes-block', identity, mode, onAuthInvalid);
}
