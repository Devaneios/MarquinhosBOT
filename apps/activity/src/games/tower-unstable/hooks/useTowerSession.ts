import type { DiscordIdentity } from '../../../discord/auth.ts';
import { useGameSession } from '../../../realtime/useGameSession';

export function useTowerSession(
  identity: DiscordIdentity,
  mode: 'single' | 'multi' | null,
  onAuthInvalid: () => void,
) {
  return useGameSession('tower-unstable', identity, mode, onAuthInvalid);
}
