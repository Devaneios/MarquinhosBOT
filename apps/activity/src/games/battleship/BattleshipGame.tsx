import { ConnectingScreen, ErrorScreen, GameMenu } from '@/games/shared/shell';
import type { DiscordIdentity } from '@/platform/discord/auth';
import { useNavigateHome } from '@/shared/motion/transitions';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BattleshipBoard } from './components/BattleshipBoard';
import { useBattleshipSession } from './session/useBattleshipSession';

export function BattleshipGame({
  identity,
  onAuthInvalid,
}: {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
}) {
  const navigate = useNavigate();
  const navigateHome = useNavigateHome();
  const [mode, setMode] = useState<'single' | 'multi' | null>(null);
  const session = useBattleshipSession(identity, mode, onAuthInvalid);

  if (session.status === 'selecting-mode') {
    return (
      <GameMenu
        gameId="battleship"
        onBack={() => navigateHome()}
        actions={[
          {
            key: 'single',
            labelKey: 'vsBot',
            labelNs: 'common',
            descriptionKey: 'vsBotDescription',
            onSelect: () => setMode('single'),
          },
          {
            key: 'multi',
            labelKey: 'vsPlayer',
            labelNs: 'common',
            descriptionKey: 'vsPlayerDescription',
            onSelect: () => navigate('/rooms?create=battleship'),
          },
        ]}
      />
    );
  }

  if (session.status === 'connecting') {
    return (
      <ConnectingScreen
        subtitleKey="connectingSubtitle"
        subtitleNs="battleship"
      />
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

  return <BattleshipBoard session={session.session} />;
}
