import { Route } from 'react-router-dom';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { WordleGame } from './WordleGame';

export function wordleRoutes(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  return (
    <Route
      path="wordle"
      element={<WordleGame identity={identity} onAuthInvalid={onAuthInvalid} />}
    />
  );
}
