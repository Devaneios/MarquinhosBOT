import { Route } from 'react-router-dom';
import type { DiscordIdentity } from '../../discord/auth.ts';
import { RpsGame } from './RpsGame';

export function rpsRoutes(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  return (
    <Route
      path="rock-paper-scissors"
      element={<RpsGame identity={identity} onAuthInvalid={onAuthInvalid} />}
    />
  );
}
