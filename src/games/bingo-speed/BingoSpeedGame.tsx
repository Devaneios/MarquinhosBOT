import { Outlet, useNavigate } from 'react-router-dom';
import { ConnectingScreen, ErrorScreen } from '../../components/game-shell';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { BingoSpeedCanvas } from './BingoSpeedCanvas';
import { useBingoSpeedSession } from './useBingoSpeedSession';

export interface BingoSpeedMenuOutletContext {
  onSelectMode: (mode: 'multi' | 'single') => void;
  onExitToHub: () => void;
}

export function BingoSpeedGame({
  identity,
  onAuthInvalid,
}: {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
}) {
  const navigate = useNavigate();
  const { session, selectMode, backToMenu } = useBingoSpeedSession(
    identity,
    onAuthInvalid,
  );

  function toMainMenu() {
    backToMenu();
    navigate('/games/bingo-speed', { replace: true });
  }

  if (session.status === 'selecting-mode') {
    return (
      <Outlet
        context={
          {
            onSelectMode: selectMode,
            onExitToHub: () => navigate('/'),
          } satisfies BingoSpeedMenuOutletContext
        }
      />
    );
  }

  if (session.status === 'connecting') {
    return (
      <ConnectingScreen
        subtitleKey="connectingSubtitle"
        subtitleNs="bingo-speed"
      />
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
    <BingoSpeedCanvas
      session={session.session}
      userId={identity.userId}
      onMainMenu={toMainMenu}
    />
  );
}
