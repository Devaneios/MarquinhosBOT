import { useNavigate } from 'react-router-dom';
import {
  ConnectingScreen,
  ErrorScreen,
} from '../../components/game-shell/index';
import type { DiscordIdentity } from '../../discord/auth.ts';
import { WordleBoard } from './components/index';
import { useWordleSession } from './hooks/useWordleSession';
import { useWordleUserConfig } from './hooks/useWordleUserConfig';

export function WordleGame({
  identity,
  onAuthInvalid,
}: {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
}) {
  const navigate = useNavigate();
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
        onBack={() => navigate('/')}
      />
    );
  }

  if (userConfig.status === 'error') {
    return (
      <ErrorScreen
        message={userConfig.error}
        onRetryAuth={userConfig.retry}
        onBack={() => navigate('/')}
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
