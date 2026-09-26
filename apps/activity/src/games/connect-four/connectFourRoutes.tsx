import type { DiscordIdentity } from '@/platform/discord/auth';
import { Route } from 'react-router-dom';
import { ConnectFourGame } from './components/index';

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
