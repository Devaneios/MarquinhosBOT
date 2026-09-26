import type { DiscordIdentity } from '@/platform/discord/auth';
import { Route } from 'react-router-dom';
import { TicTacToeGame } from './TicTacToeGame';

export function ticTacToeRoutes(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  return (
    <Route
      path="tic-tac-toe"
      element={
        <TicTacToeGame identity={identity} onAuthInvalid={onAuthInvalid} />
      }
    />
  );
}
