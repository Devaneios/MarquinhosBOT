import { Fragment } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import type { DiscordIdentity } from './discord/auth.ts';
import { GAME_REGISTRY } from './games/registry';
import { Hub } from './hub/Hub';
import { useDeepLinkIntent } from './navigation/useDeepLinkIntent';
import { RoomRoute } from './rooms/RoomRoute';

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
      <Route index element={<Hub />} />
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
