import type { DiscordIdentity } from '@/discord/auth';
import { Route } from 'react-router-dom';
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
