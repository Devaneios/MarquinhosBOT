import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ConnectingScreen,
  ErrorScreen,
  ModeSelectScreen,
} from '../../components/game-shell';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { TowerCanvas } from './components/TowerCanvas';
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
      <ModeSelectScreen
        onBack={toMainMenu}
        options={[
          {
            key: 'single',
            labelKey: 'vsBot',
            labelNs: 'common',
            onSelect: () => setMode('single'),
          },
          {
            key: 'multi',
            labelKey: 'vsPlayer',
            labelNs: 'common',
            onSelect: () => setMode('multi'),
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
