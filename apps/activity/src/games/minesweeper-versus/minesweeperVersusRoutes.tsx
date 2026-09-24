import { Route } from 'react-router-dom';
import type { DiscordIdentity } from '../../discord/auth.ts';
import { MinesweeperVersusGame } from './components/index';

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
