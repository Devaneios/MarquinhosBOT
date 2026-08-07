import { Route } from 'react-router-dom';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { SnakeGameContainer } from './SnakeGameContainer';

export function snakeRoutes(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  return (
    <Route
      path="snake-game"
      element={
        <SnakeGameContainer identity={identity} onAuthInvalid={onAuthInvalid} />
      }
    />
  );
}
