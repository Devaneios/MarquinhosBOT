import { useEffect } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { DevConsole } from './components/DevConsole';
import { useDiscordIdentity } from './hooks/useDiscordIdentity';
import { AppRoutes } from './routes';

function App() {
  const identity = useDiscordIdentity();

  useEffect(() => {
    console.log('[app] identity status', identity.status);
  }, [identity.status]);

  return (
    <div className="app-shell relative flex h-full w-full flex-col overflow-hidden bg-marquinhos-bg text-marquinhos-text">
      {identity.status === 'loading' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <div className="font-pixel animate-pong-blink text-sm text-marquinhos-accent">
            CONNECTING…
          </div>
        </div>
      )}
      {identity.status === 'error' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <div className="font-pixel text-lg text-marquinhos-danger">
            CONNECTION FAILED
          </div>
          <div className="max-w-[480px] text-center text-marquinhos-text-dim">
            {identity.error}
          </div>
        </div>
      )}
      {identity.status === 'ready' && (
        <MemoryRouter>
          <AppRoutes
            identity={identity.identity}
            onAuthInvalid={identity.reauth}
          />
        </MemoryRouter>
      )}
      {import.meta.env.DEV && <DevConsole />}
    </div>
  );
}

export default App;
