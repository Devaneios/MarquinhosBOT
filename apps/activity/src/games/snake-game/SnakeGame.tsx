import { useNavigate } from 'react-router-dom';
import {
  ConnectingScreen,
  ErrorScreen,
  GameMenu,
} from '../../components/game-shell';
import type { DiscordIdentity } from '../../discordAuth.ts';
import { SnakeCanvas } from './components';
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
      <GameMenu
        gameId="snake-game"
        onBack={() => navigate('/')}
        actions={[
          {
            key: 'single',
            labelKey: 'singlePlayer',
            labelNs: 'snake-game',
            descriptionKey: 'singlePlayerDescription',
            onSelect: () => selectMode('single'),
          },
          {
            key: 'multi',
            labelKey: 'twoPlayer',
            labelNs: 'snake-game',
            descriptionKey: 'twoPlayerDescription',
            onSelect: () => navigate('/rooms?create=snake-game'),
          },
        ]}
      />
    );
  }

  if (session.status === 'connecting') {
    return (
      <ConnectingScreen
        subtitleKey="connectingSubtitle"
        subtitleNs="snake-game"
      />
    );
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
