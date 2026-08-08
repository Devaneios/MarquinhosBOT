import { Route } from 'react-router-dom';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { MinesweeperVersusGame } from './MinesweeperVersusGame';

export function minesweeperVersusRoutes(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  return (
    <Route
      path="minesweeper-versus"
      element={
        <MinesweeperVersusGame
          identity={identity}
          onAuthInvalid={onAuthInvalid}
        />
      }
    />
  );
}
