import type { DiscordIdentity } from '@/platform/discord/auth';
import { Route } from 'react-router-dom';
import { PongMenuFlow } from './hooks/PongMenuFlow';
import { PongGame } from './PongGame';
import {
  CompetitiveScreenRoute,
  HowToPlayRoute,
  MainMenuRoute,
  ModeMenuRoute,
  SettingsScreenRoute,
} from './pongRouteViews';

export function pongRoutes(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  return (
    <Route
      path="pong"
      element={<PongGame identity={identity} onAuthInvalid={onAuthInvalid} />}
    >
      <Route element={<PongMenuFlow />}>
        <Route index element={<MainMenuRoute />} />
        <Route path="mode" element={<ModeMenuRoute />} />
        <Route path="settings" element={<SettingsScreenRoute />} />
        <Route path="how-to" element={<HowToPlayRoute />} />
        <Route
          path="competitive"
          element={<CompetitiveScreenRoute identity={identity} />}
        />
      </Route>
    </Route>
  );
}
