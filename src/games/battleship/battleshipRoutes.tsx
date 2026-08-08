import { Route } from 'react-router-dom';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { BattleshipGame } from './BattleshipGame';

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
