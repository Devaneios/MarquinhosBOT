import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { RoomLobbyScreen, type RoomReadyInfo } from '../components/game-shell';
import type { GameId } from '../games/gameId';
import type { DiscordIdentity } from '../discordAuth.ts';
import { RoomView } from './RoomView';

export function RoomRoute({ identity }: { identity: DiscordIdentity }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [joined, setJoined] = useState<RoomReadyInfo | null>(null);

  if (!joined) {
    return (
      <RoomLobbyScreen
        identity={identity}
        preselectedGame={(searchParams.get('create') as GameId | null) ?? undefined}
        onRoomReady={setJoined}
        onBack={() => navigate('/')}
      />
    );
  }

  return <RoomView identity={identity} {...joined} onLeave={() => navigate('/')} />;
}
