import type { DiscordIdentity } from '../../../hooks/useDiscordIdentity';
import { useGameSession } from '../../shared/useGameSession';

export function useDominoesSession(
  identity: DiscordIdentity,
  mode: 'single' | 'multi' | null,
  onAuthInvalid: () => void,
) {
  return useGameSession('dominoes-block', identity, mode, onAuthInvalid);
}
