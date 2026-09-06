import { Route } from 'react-router-dom';
import type { DiscordIdentity } from '../../discordAuth.ts';
import { ConnectFourGame } from './components';

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
