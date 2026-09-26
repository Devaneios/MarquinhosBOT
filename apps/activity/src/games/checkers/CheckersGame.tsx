import { ConnectingScreen, ErrorScreen } from '@/games/shared/shell';
import type { DiscordIdentity } from '@/platform/discord/auth';
import { useNavigate } from 'react-router-dom';
import { CheckersBoard } from './components/CheckersBoard';
import { CheckersMenus } from './components/CheckersMenus';
import { useCheckersSession } from './session/useCheckersSession';

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
      <CheckersMenus
        onSelectMode={selectMode}
        onExitToHub={() => navigate('/')}
      />
    );
  }

  if (session.status === 'connecting') {
    return (
      <ConnectingScreen
        subtitleKey="connectingSubtitle"
        subtitleNs="checkers"
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
    <CheckersBoard
      session={session.session}
      mode={session.mode}
      onMainMenu={toMainMenu}
    />
  );
}
