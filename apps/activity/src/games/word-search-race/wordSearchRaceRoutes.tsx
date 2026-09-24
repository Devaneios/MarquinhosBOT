import { Route } from 'react-router-dom';
import type { DiscordIdentity } from '../../discord/auth.ts';
import { WordSearchRaceGame } from './WordSearchRaceGame';

export function wordSearchRaceRoutes(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  return (
    <Route
      path="word-search-race"
      element={
        <WordSearchRaceGame identity={identity} onAuthInvalid={onAuthInvalid} />
      }
    />
  );
}
