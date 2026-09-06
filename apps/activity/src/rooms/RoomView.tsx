import { useTranslation } from 'react-i18next';
import {
  ConnectingScreen,
  ErrorScreen,
  RoomHeader,
} from '../components/game-shell';
import type { DiscordIdentity } from '../discordAuth.ts';
import type { GameId } from '../games/gameId';
import { GAME_REGISTRY } from '../games/registry';
import {
  RoomConnectionProvider,
  useRoomConnectionContext,
} from '../games/shared/RoomConnectionProvider';

function RoomBoard({ identity }: { identity: DiscordIdentity }) {
  const ctx = useRoomConnectionContext();
  const { t } = useTranslation('rooms');

  // Connection-level states take priority over game-rendering — reuse the
  // existing ConnectingScreen/ErrorScreen pattern from App.tsx's own
  // identity-loading states, not a bespoke room-specific spinner/error UI.
  if (ctx?.connectionState === 'connecting' || !ctx) {
    return (
      <ConnectingScreen subtitleKey="connectingSubtitle" subtitleNs="common" />
    );
  }
  if (
    ctx.connectionState === 'error' ||
    ctx.connectionState === 'disconnected'
  ) {
    return <ErrorScreen message={t('roomConnectionLost')} />;
  }
  if (!ctx.roomState) return null; // connected, first state sync not yet received — one frame, no UI needed

  const descriptor = GAME_REGISTRY.find((g) => g.id === ctx.roomState?.game);
  if (!descriptor?.renderRoomBoard) {
    return (
      <div className="p-6 text-center text-sm text-marquinhos-text-dim">
        {t('spectatingNoLiveView')}
      </div>
    );
  }
  return descriptor.renderRoomBoard({ identity });
}

export function RoomView({
  identity,
  roomId,
  token,
  roomKey,
  game,
  queueEnabled,
  onLeave,
}: {
  identity: DiscordIdentity;
  roomId: string;
  token: string;
  roomKey: string;
  game: GameId;
  queueEnabled: boolean;
  onLeave: () => void;
}) {
  return (
    <RoomConnectionProvider
      roomId={roomId}
      session={{ token, roomKey }}
      game={game}
      queueEnabled={queueEnabled}
      identity={identity}
    >
      <div className="flex h-full flex-col">
        <RoomHeader onLeave={onLeave} />
        <div className="flex-1 overflow-auto">
          <RoomBoard identity={identity} />
        </div>
      </div>
    </RoomConnectionProvider>
  );
}
