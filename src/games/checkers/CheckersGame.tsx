import { Outlet, useNavigate } from 'react-router-dom';
import { ConnectingScreen, ErrorScreen } from '../../components/game-shell';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { CheckersBoard } from './CheckersBoard';
import type { CheckersMenuOutletContext } from './CheckersMenuFlow';
import { useCheckersSession } from './useCheckersSession';

export function CheckersGame({
  identity,
  onAuthInvalid,
}: {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
}) {
  const navigate = useNavigate();
  const { session, selectMode, backToMenu } = useCheckersSession(
    identity,
    onAuthInvalid,
  );

  function toMainMenu() {
    backToMenu();
    navigate('/games/checkers', { replace: true });
  }

  if (session.status === 'selecting-mode') {
    return (
      <Outlet
        context={
          {
            onSelectMode: selectMode,
            onExitToHub: () => navigate('/'),
          } satisfies CheckersMenuOutletContext
        }
      />
    );
  }

  if (session.status === 'connecting') {
    return (
      <ConnectingScreen subtitleKey="connectingSubtitle" subtitleNs="checkers" />
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
    <CheckersBoard
      session={session.session}
      mode={session.mode}
      onMainMenu={toMainMenu}
    />
  );
}
