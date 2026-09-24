import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ConnectingScreen,
  ErrorScreen,
  GameMenu,
} from '../../components/game-shell/index';
import type { DiscordIdentity } from '../../discord/auth.ts';
import { DominoesBlockBoard } from './components/index';
import { useDominoesSession } from './hooks/useDominoesSession';

export function DominoesBlockGame({
  identity,
  onAuthInvalid,
}: {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
}) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'single' | 'multi' | null>(null);
  const session = useDominoesSession(identity, mode, onAuthInvalid);

  if (session.status === 'selecting-mode') {
    return (
      <GameMenu
        gameId="dominoes-block"
        onBack={() => navigate('/')}
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
            onSelect: () => navigate('/rooms?create=dominoes-block'),
          },
        ]}
      />
    );
  }

  if (session.status === 'connecting') {
    return (
      <ConnectingScreen
        subtitleKey="connectingSubtitle"
        subtitleNs="dominoes-block"
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
    <DominoesBlockBoard session={session.session} selfId={identity.userId} />
  );
}
