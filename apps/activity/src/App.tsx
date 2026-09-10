import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { DevConsole } from './components/DevConsole';
import { ConnectingScreen, ErrorScreen } from './components/game-shell';
import { MinimizedOverlay } from './components/MinimizedOverlay';
import { isMobilePlatform } from './discordSdk';
import { useDiscordIdentity } from './hooks/useDiscordIdentity';
import { useIsActivityMinimized } from './hooks/useIsActivityMinimized';
import { devlog } from './lib/devlog';
import { AppRoutes } from './routes';

function App() {
  const identity = useDiscordIdentity();
  const isMinimized = useIsActivityMinimized();
  const { t } = useTranslation('common');

  useEffect(() => {
    devlog('[app] identity status', identity.status);
  }, [identity.status]);

  return (
    <div className="app-shell relative flex h-full w-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top,rgba(255,176,0,0.12),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_20%),var(--color-marquinhos-bg)] text-marquinhos-text">
      {identity.status === 'loading' && (
        <ConnectingScreen
          subtitleKey="connectingSubtitle"
          subtitleNs="common"
        />
      )}

      {identity.status === 'error' && (
        <ErrorScreen
          message={identity.error}
          onRetryAuth={identity.reauth}
          hint={t('authTimeoutHint')}
        />
      )}

      {identity.status === 'ready' && (
        <MemoryRouter>
          <AppRoutes
            identity={identity.identity}
            onAuthInvalid={identity.reauth}
          />
        </MemoryRouter>
      )}

      {import.meta.env.DEV && !isMobilePlatform() && <DevConsole />}

      {isMinimized && <MinimizedOverlay />}
    </div>
  );
}

export default App;
