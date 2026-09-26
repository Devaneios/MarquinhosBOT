import type { DiscordIdentity } from '@/discord/auth';
import { useGameSession } from '@/realtime/useGameSession';

export function useHangmanSession(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  return useGameSession('hangman', identity, 'multi', onAuthInvalid);
}
