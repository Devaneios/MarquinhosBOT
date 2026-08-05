import { Fragment } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { GAME_REGISTRY } from './games/registry';
import type { DiscordIdentity } from './hooks/useDiscordIdentity';
import { Hub } from './hub/Hub';

export function AppRoutes({
  identity,
  onAuthInvalid,
}: {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
}) {
  return (
    <Routes>
      <Route index element={<Hub />} />
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
