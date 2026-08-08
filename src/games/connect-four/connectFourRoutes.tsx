import { Route } from 'react-router-dom';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { ConnectFourGame } from './ConnectFourGame';

export function connectFourRoutes(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  return (
    <Route
      path="connect-four"
      element={
        <ConnectFourGame identity={identity} onAuthInvalid={onAuthInvalid} />
      }
    />
  );
}
