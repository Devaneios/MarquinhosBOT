import { Route } from 'react-router-dom';
import type { DiscordIdentity } from '../../discordAuth.ts';
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
