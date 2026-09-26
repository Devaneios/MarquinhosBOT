import { HubScreen } from '@/features/hub/HubScreen';
import { RoomRoute } from '@/features/rooms/RoomRoute';
import { GAME_REGISTRY } from '@/games/registry';
import type { DiscordIdentity } from '@/platform/discord/auth';
import { Fragment } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useDeepLinkIntent } from './navigation/useDeepLinkIntent';

export function AppRoutes({
  identity,
  onAuthInvalid,
}: {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
}) {
  useDeepLinkIntent(identity);

  return (
    <Routes>
      <Route index element={<HubScreen />} />
      <Route path="rooms" element={<RoomRoute identity={identity} />} />
      <Route path="games">
        {GAME_REGISTRY.map((game) => (
          <Fragment key={game.id}>
            {game.routes(identity, onAuthInvalid)}
          </Fragment>
        ))}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
