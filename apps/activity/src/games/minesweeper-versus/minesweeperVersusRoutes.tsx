import type { DiscordIdentity } from '@/platform/discord/auth';
import { Route } from 'react-router-dom';
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
