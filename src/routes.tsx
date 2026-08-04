import { Route, Routes } from 'react-router-dom';
import { pongRoutes } from './games/pong/pongRoutes';
import { Hub } from './hub/Hub';
import type { DiscordIdentity } from './hooks/useDiscordIdentity';

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
      <Route path="games">{pongRoutes(identity, onAuthInvalid)}</Route>
    </Routes>
  );
}
