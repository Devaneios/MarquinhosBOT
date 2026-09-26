import type { DiscordIdentity } from '@/platform/discord/auth';
import { Route } from 'react-router-dom';
import { SnakeGame } from './SnakeGame';

export function snakeRoutes(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  return (
    <Route
      path="snake-game"
      element={<SnakeGame identity={identity} onAuthInvalid={onAuthInvalid} />}
    />
  );
}
