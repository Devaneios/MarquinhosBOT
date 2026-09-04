import { useNavigate } from 'react-router-dom';
import {
  ConnectingScreen,
  ErrorScreen,
  ModeSelectScreen,
} from '../../components/game-shell';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { SnakeCanvas } from './components/SnakeCanvas';
import { useSnakeSession } from './hooks/useSnakeSession';

export function SnakeGame({
  identity,
  onAuthInvalid,
}: {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
}) {
  const navigate = useNavigate();
  const { session, selectMode, backToMenu } = useSnakeSession(
    identity,
    onAuthInvalid,
  );

  if (session.status === 'selecting-mode') {
    return (
      <ModeSelectScreen
        onBack={() => navigate('/')}
        options={[
          {
            key: 'single',
            labelKey: 'singlePlayer',
            labelNs: 'snake-game',
            onSelect: () => selectMode('single'),
          },
          {
            key: 'multi',
            labelKey: 'twoPlayer',
            labelNs: 'snake-game',
            onSelect: () => navigate('/rooms?create=snake-game'),
          },
        ]}
      />
    );
  }

  if (session.status === 'connecting') {
    return <ConnectingScreen />;
  }

  if (session.status === 'error') {
    return (
      <ErrorScreen
        message={session.error}
        onRetryAuth={onAuthInvalid}
        onBack={backToMenu}
      />
    );
  }

  return (
    <SnakeCanvas
      session={session.session}
      mode={session.mode}
      onMainMenu={backToMenu}
    />
  );
}
