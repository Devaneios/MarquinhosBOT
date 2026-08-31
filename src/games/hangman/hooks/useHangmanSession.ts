import type { DiscordIdentity } from '../../../hooks/useDiscordIdentity';
import { useGameSession } from '../../shared/useGameSession';

export function useHangmanSession(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  return useGameSession('hangman', identity, 'multi', onAuthInvalid);
}
