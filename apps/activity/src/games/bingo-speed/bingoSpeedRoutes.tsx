import type { DiscordIdentity } from '@/platform/discord/auth';
import { Route } from 'react-router-dom';
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
