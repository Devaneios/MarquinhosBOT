import type { DiscordIdentity } from '@/platform/discord/auth';
import { Route } from 'react-router-dom';
import { HangmanGame } from './HangmanGame';

export function hangmanRoutes(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  return (
    <Route
      path="hangman"
      element={
        <HangmanGame identity={identity} onAuthInvalid={onAuthInvalid} />
      }
    />
  );
}
