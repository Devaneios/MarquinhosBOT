import { ConnectingScreen, ErrorScreen, GameMenu } from '@/games/shared/shell';
import type { DiscordIdentity } from '@/platform/discord/auth';
import { useNavigateHome } from '@/shared/motion/transitions';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DominoesBlockBoard } from './components/DominoesBlockBoard';
import { useDominoesSession } from './session/useDominoesSession';

export function DominoesBlockGame({
  identity,
  onAuthInvalid,
}: {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
}) {
  const navigate = useNavigate();
  const navigateHome = useNavigateHome();
  const [mode, setMode] = useState<'single' | 'multi' | null>(null);
  const session = useDominoesSession(identity, mode, onAuthInvalid);

  if (session.status === 'selecting-mode') {
    return (
      <GameMenu
        gameId="dominoes-block"
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
        onBack={() => navigateHome()}
      />
    );
  }

  return (
    <DominoesBlockBoard session={session.session} selfId={identity.userId} />
  );
}
