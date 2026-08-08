import { Route } from 'react-router-dom';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { WordleRaceGame } from './WordleRaceGame';

export function wordleRaceRoutes(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  return (
    <Route
      path="wordle-race"
      element={
        <WordleRaceGame identity={identity} onAuthInvalid={onAuthInvalid} />
      }
    />
  );
}
