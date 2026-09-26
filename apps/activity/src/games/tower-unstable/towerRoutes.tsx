import type { DiscordIdentity } from '@/platform/discord/auth';
import { Route } from 'react-router-dom';
import { TowerGame } from './TowerGame';

export function towerRoutes(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  return (
    <Route
      path="tower-unstable"
      element={<TowerGame identity={identity} onAuthInvalid={onAuthInvalid} />}
    />
  );
}
