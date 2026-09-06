import type { DiscordIdentity } from '../../../discordAuth.ts';
import { useGameSession } from '../../shared/useGameSession';

export function useTowerSession(
  identity: DiscordIdentity,
  mode: 'single' | 'multi' | null,
  onAuthInvalid: () => void,
) {
  return useGameSession('tower-unstable', identity, mode, onAuthInvalid);
}
