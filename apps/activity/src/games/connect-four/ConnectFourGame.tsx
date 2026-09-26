import { ConnectingScreen, ErrorScreen } from '@/games/shared/shell';
import type { DiscordIdentity } from '@/platform/discord/auth';
import { useNavigate } from 'react-router-dom';
import { ConnectFourBoard } from './components/ConnectFourBoard';
import { ConnectFourModeMenu } from './components/ConnectFourModeMenu';
import { useConnectFourSession } from './session/useConnectFourSession';

export function ConnectFourGame({
  identity,
  onAuthInvalid,
}: {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
}) {
  const navigate = useNavigate();
  const { session, selectMode, backToMenu } = useConnectFourSession(
    identity,
    onAuthInvalid,
  );

  if (session.status === 'selecting-mode') {
    return (
      <ConnectFourModeMenu
        onSelect={(mode) => {
          if (mode === 'multi') {
            navigate('/rooms?create=connect-four');
            return;
          }
          selectMode(mode);
        }}
        onExitToHub={() => navigate('/')}
      />
    );
  }

  if (session.status === 'connecting') {
    return (
      <ConnectingScreen
        subtitleKey="connectingSubtitle"
        subtitleNs="connect-four"
      />
    );
  }

  if (session.status === 'error') {
    return (
      <ErrorScreen
        message={session.error}
        onRetryAuth={onAuthInvalid}
        onBack={() => navigate('/')}
      />
    );
  }

  return (
    <ConnectFourBoard
      session={session.session}
      mode={session.mode}
      onBackToMenu={backToMenu}
    />
  );
}
