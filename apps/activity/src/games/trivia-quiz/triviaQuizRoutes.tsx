import type { DiscordIdentity } from '@/discord/auth';
import { Route } from 'react-router-dom';
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
