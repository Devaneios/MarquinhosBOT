import type { DiscordIdentity } from '@/platform/discord/auth';
import { Route } from 'react-router-dom';
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
