import { useGameSession } from '@/games/shared/session/useGameSession';
import type { DiscordIdentity } from '@/platform/discord/auth';

export function useTowerSession(
  identity: DiscordIdentity,
  mode: 'single' | 'multi' | null,
  onAuthInvalid: () => void,
) {
  return useGameSession('tower-unstable', identity, mode, onAuthInvalid);
}
