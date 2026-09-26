import { ConnectingScreen, ErrorScreen } from '@/games/shared/shell';
import type { DiscordIdentity } from '@/platform/discord/auth';
import { useNavigate } from 'react-router-dom';
import { PongBoard } from './components/PongBoard';
import { PongMenus } from './components/PongMenus';
import { usePongSession } from './session/usePongSession';

export function PongGame({
  identity,
  onAuthInvalid,
}: {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
}) {
  const navigate = useNavigate();
  const { session, selectMode, backToMenu } = usePongSession(
    identity,
    onAuthInvalid,
  );

  function toMainMenu() {
    backToMenu();
    navigate('/games/pong', { replace: true });
  }

  if (session.status === 'selecting-mode') {
    return (
      <PongMenus
        identity={identity}
        onSelectMode={selectMode}
        onExitToHub={() => navigate('/')}
      />
    );
  }

  if (session.status === 'connecting') {
    return (
      <ConnectingScreen subtitleKey="connectingSubtitle" subtitleNs="pong" />
    );
  }

  if (session.status === 'error') {
    return (
      <ErrorScreen
        message={session.error}
        onRetryAuth={onAuthInvalid}
        onBack={toMainMenu}
      />
    );
  }

  return (
    <PongBoard
      session={session.session}
      mode={session.mode}
      sound={session.sound}
      onMainMenu={toMainMenu}
    />
  );
}
