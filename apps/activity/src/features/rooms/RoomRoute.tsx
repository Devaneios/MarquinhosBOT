import type { DiscordIdentity } from '@/platform/discord/auth';
import { isGameId } from '@marquinhos/contracts/activity/gameId';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { RoomLobbyScreen, type RoomReadyInfo } from './screens/RoomLobbyScreen';
import { RoomView } from './screens/RoomView';

export function RoomRoute({ identity }: { identity: DiscordIdentity }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [joined, setJoined] = useState<RoomReadyInfo | null>(null);

  if (!joined) {
    const createGame = searchParams.get('create');
    return (
      <RoomLobbyScreen
        identity={identity}
        preselectedGame={isGameId(createGame) ? createGame : undefined}
        onRoomReady={setJoined}
        onBack={() => navigate('/')}
      />
    );
  }

  return (
    <RoomView identity={identity} {...joined} onLeave={() => navigate('/')} />
  );
}
