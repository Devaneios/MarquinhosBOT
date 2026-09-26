import type { DiscordIdentity } from '@/platform/discord/auth';
import { Route } from 'react-router-dom';
import { BattleshipGame } from './components/index';

export function battleshipRoutes(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  return (
    <Route
      path="battleship"
      element={
        <BattleshipGame identity={identity} onAuthInvalid={onAuthInvalid} />
      }
    />
  );
}
