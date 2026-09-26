import { ConnectingScreen, ErrorScreen } from '@/games/shared/shell';
import type { DiscordIdentity } from '@/platform/discord/auth';
import { useNavigateHome } from '@/shared/motion/transitions';
import {} from 'react-router-dom';
import { WordleBoard } from './components/WordleBoard';
import { useWordleSession } from './session/useWordleSession';
import { useWordleUserConfig } from './state/useWordleUserConfig';

export function WordleGame({
  identity,
  onAuthInvalid,
}: {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
}) {
  const navigateHome = useNavigateHome();
  const session = useWordleSession(identity, onAuthInvalid);
  const userConfig = useWordleUserConfig(identity.accessToken, onAuthInvalid);

  if (session.status === 'connecting' || userConfig.status === 'loading') {
    return (
      <ConnectingScreen subtitleKey="connectingSubtitle" subtitleNs="wordle" />
    );
  }

  if (session.status === 'error') {
    return (
      <ErrorScreen
        message={session.error}
        onRetryAuth={onAuthInvalid}
        onBack={() => navigateHome()}
      />
    );
  }

  if (userConfig.status === 'error') {
    return (
      <ErrorScreen
        message={userConfig.error}
        onRetryAuth={userConfig.retry}
        onBack={() => navigateHome()}
      />
    );
  }

  return (
    <WordleBoard
      session={session.session}
      config={userConfig.config}
      onSaveConfig={userConfig.save}
    />
  );
}
