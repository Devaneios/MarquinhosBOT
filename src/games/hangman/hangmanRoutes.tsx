import { Route } from 'react-router-dom';
import type { DiscordIdentity } from '../../discordAuth.ts';
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
