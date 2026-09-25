import { Route } from 'react-router-dom';
import type { DiscordIdentity } from '../../discord/auth.ts';
import { CheckersGame } from './CheckersGame';
import {
  HowToPlayRoute,
  MainMenuRoute,
  ModeMenuRoute,
} from './checkersRouteViews';
import { CheckersMenuFlow } from './hooks/CheckersMenuFlow';

export function checkersRoutes(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  return (
    <Route
      path="checkers"
      element={
        <CheckersGame identity={identity} onAuthInvalid={onAuthInvalid} />
      }
    >
      <Route element={<CheckersMenuFlow />}>
        <Route index element={<MainMenuRoute />} />
        <Route path="mode" element={<ModeMenuRoute />} />
        <Route path="how-to" element={<HowToPlayRoute />} />
      </Route>
    </Route>
  );
}
