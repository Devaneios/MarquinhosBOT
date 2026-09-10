import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ConnectingScreen,
  ErrorScreen,
  GameMenu,
} from '../../components/game-shell';
import type { DiscordIdentity } from '../../discordAuth.ts';
import { TowerCanvas } from './components';
import { useTowerSession } from './hooks/useTowerSession';

export function TowerGame({
  identity,
  onAuthInvalid,
}: {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
}) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'single' | 'multi' | null>(null);
  const session = useTowerSession(identity, mode, onAuthInvalid);

  function toMainMenu() {
    navigate('/', { replace: true });
  }

  if (session.status === 'selecting-mode') {
    return (
      <GameMenu
        gameId="tower-unstable"
        onBack={toMainMenu}
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
            onSelect: () => navigate('/rooms?create=tower-unstable'),
          },
        ]}
      />
    );
  }

  if (session.status === 'connecting') {
    return (
      <ConnectingScreen
        subtitleKey="connectingSubtitle"
        subtitleNs="tower-unstable"
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
    <TowerCanvas
      session={session.session}
      userId={identity.userId}
      onMainMenu={toMainMenu}
    />
  );
}
