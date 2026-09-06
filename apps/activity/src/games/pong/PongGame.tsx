import { Outlet, useNavigate } from 'react-router-dom';
import { ConnectingScreen, ErrorScreen } from '../../components/game-shell';
import type { DiscordIdentity } from '../../discordAuth.ts';
import { PongCanvas } from './components';
import type { PongMenuOutletContext } from './hooks/PongMenuFlow';
import { usePongSession } from './hooks/usePongSession';

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
      <Outlet
        context={
          {
            onSelectMode: selectMode,
            onExitToHub: () => navigate('/'),
          } satisfies PongMenuOutletContext
        }
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
    <PongCanvas
      session={session.session}
      mode={session.mode}
      sound={session.sound}
      onMainMenu={toMainMenu}
    />
  );
}
