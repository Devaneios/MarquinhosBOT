import { Route } from 'react-router-dom';
import type { DiscordIdentity } from '../../discordAuth.ts';
import { TriviaQuizGame } from './TriviaQuizGame';

export function triviaQuizRoutes(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  return (
    <Route
      path="trivia-quiz"
      element={
        <TriviaQuizGame identity={identity} onAuthInvalid={onAuthInvalid} />
      }
    />
  );
}
