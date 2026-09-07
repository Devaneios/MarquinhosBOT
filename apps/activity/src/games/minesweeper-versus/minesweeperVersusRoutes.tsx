import { Route } from 'react-router-dom';
import type { DiscordIdentity } from '../../discordAuth.ts';
import { MinesweeperVersusGame } from './components';

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
