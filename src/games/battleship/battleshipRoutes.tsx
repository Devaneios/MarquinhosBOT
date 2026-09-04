import { Route } from 'react-router-dom';
import type { DiscordIdentity } from '../../discordAuth.ts';
import { BattleshipGame } from './components';

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
