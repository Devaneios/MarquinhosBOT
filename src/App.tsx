import { useEffect } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { DevConsole } from './components/DevConsole';
import { useDiscordIdentity } from './hooks/useDiscordIdentity';
import { devlog } from './lib/devlog';
import { AppRoutes } from './routes';

function App() {
  const identity = useDiscordIdentity();

  useEffect(() => {
    devlog('[app] identity status', identity.status);
  }, [identity.status]);

  return (
    <div className="app-shell relative flex h-full w-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,176,0,0.12),_transparent_32%),linear-gradient(180deg,_rgba(255,255,255,0.02),_transparent_20%),var(--color-marquinhos-bg)] text-marquinhos-text">
      {identity.status === 'loading' && (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="notch-8 flex min-h-[260px] w-full max-w-[520px] flex-col items-center justify-center gap-4 border border-marquinhos-border bg-marquinhos-panel px-8 py-10 text-center shadow-[0_20px_40px_rgba(0,0,0,0.28)]">
            <div className="font-pixel animate-pong-blink text-sm tracking-[0.28em] text-marquinhos-accent">
              CONNECTING…
            </div>
            <div className="max-w-[36ch] text-sm leading-6 text-marquinhos-text-dim">
              Syncing Discord identity and preparing the activity shell.
            </div>
          </div>
        </div>
      )}

      {identity.status === 'error' && (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="notch-8 flex min-h-[260px] w-full max-w-[560px] flex-col items-center justify-center gap-5 border border-marquinhos-border bg-marquinhos-panel px-8 py-10 text-center shadow-[0_20px_40px_rgba(0,0,0,0.28)]">
            <div className="font-pixel text-lg tracking-[0.24em] text-marquinhos-danger">
              CONNECTION FAILED
            </div>
            <div className="max-w-[48ch] text-sm leading-6 text-marquinhos-text-dim">
              {identity.error}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                className="notch-6 border border-marquinhos-accent/60 bg-marquinhos-accent px-5 py-3 text-sm font-semibold text-black transition hover:bg-marquinhos-accent-hover"
                onClick={identity.reauth}
              >
                Retry auth
              </button>
              <button
                type="button"
                className="notch-6 border border-marquinhos-border bg-marquinhos-bg px-5 py-3 text-sm text-marquinhos-text transition hover:border-marquinhos-border-hover"
                onClick={() => window.location.reload()}
              >
                Reload
              </button>
            </div>
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
