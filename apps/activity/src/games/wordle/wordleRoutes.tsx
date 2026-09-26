import type { DiscordIdentity } from '@/platform/discord/auth';
import { Route } from 'react-router-dom';
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
