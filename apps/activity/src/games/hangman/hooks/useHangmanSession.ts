import { useGameSession } from '@/games/shared/session/useGameSession';
import type { DiscordIdentity } from '@/platform/discord/auth';

export function useHangmanSession(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  return useGameSession('hangman', identity, 'multi', onAuthInvalid);
}
