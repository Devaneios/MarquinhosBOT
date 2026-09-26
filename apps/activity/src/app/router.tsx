import { HubScreen } from '@/features/hub/HubScreen';
import { RoomRoute } from '@/features/rooms/RoomRoute';
import { GAME_REGISTRY } from '@/games/registry';
import { ConnectingScreen } from '@/games/shared/shell';
import type { DiscordIdentity } from '@/platform/discord/auth';
import { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

export function AppRoutes({
  identity,
  onAuthInvalid,
}: {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
}) {
  return (
    <Routes>
      <Route index element={<HubScreen />} />
      <Route path="rooms" element={<RoomRoute identity={identity} />} />
      <Route path="games">
        {GAME_REGISTRY.map((game) => (
          <Route
            key={game.id}
            path={`${game.id}/*`}
            element={
              <Suspense
                fallback={
                  <ConnectingScreen
                    subtitleKey="connectingSubtitle"
                    subtitleNs="common"
                  />
                }
              >
                <game.Game identity={identity} onAuthInvalid={onAuthInvalid} />
              </Suspense>
            }
          />
        ))}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
