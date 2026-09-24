import { Route } from 'react-router-dom';
import type { DiscordIdentity } from '../../discord/auth.ts';
import { BingoSpeedGame } from './BingoSpeedGame';

export function bingoSpeedRoutes(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  return (
    <Route
      path="bingo-speed"
      element={
        <BingoSpeedGame identity={identity} onAuthInvalid={onAuthInvalid} />
      }
    />
  );
}
