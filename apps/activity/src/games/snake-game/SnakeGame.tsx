import { ConnectingScreen, ErrorScreen, GameMenu } from '@/games/shared/shell';
import type { DiscordIdentity } from '@/platform/discord/auth';
import { useNavigateHome } from '@/shared/motion/transitions';
import { useNavigate } from 'react-router-dom';
import { SnakeBoard } from './components/SnakeBoard';
import { useSnakeSession } from './session/useSnakeSession';

export function SnakeGame({
  identity,
  onAuthInvalid,
}: {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
}) {
  const navigate = useNavigate();
  const navigateHome = useNavigateHome();
  const { session, selectMode, backToMenu } = useSnakeSession(
    identity,
    onAuthInvalid,
  );

  if (session.status === 'selecting-mode') {
    return (
      <GameMenu
        gameId="snake-game"
        onBack={() => navigateHome()}
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
    <SnakeBoard
      session={session.session}
      mode={session.mode}
      onMainMenu={backToMenu}
    />
  );
}
