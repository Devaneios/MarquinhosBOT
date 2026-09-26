import type { DiscordIdentity } from '@/discord/auth';
import { Route } from 'react-router-dom';
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
