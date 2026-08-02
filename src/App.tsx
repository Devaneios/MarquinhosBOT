import './App.css';
import { PongCanvas } from './games/pong/PongCanvas';
import { ModeMenu } from './games/pong/ModeMenu';
import { useDiscordAuth } from './hooks/useDiscordAuth';

function statusText(status: string): string {
  switch (status) {
    case 'loading':
      return 'Connecting…';
    case 'error':
      return 'Error';
    case 'selecting-mode':
      return 'Choose a mode';
    case 'connecting':
      return 'Starting…';
    case 'ready':
      return 'Playing';
    default:
      return '';
  }
}

function App() {
  const auth = useDiscordAuth();

  return (
    <div className="app">
      <header className="app-header">
        <h1>Marquinhos Pong</h1>
        <p className="app-status">{statusText(auth.status)}</p>
      </header>
      <main className="app-main">
        {auth.status === 'loading' && <p>Connecting to Discord…</p>}
        {auth.status === 'error' && <p>Failed to connect: {auth.error}</p>}
        {auth.status === 'selecting-mode' && (
          <ModeMenu onSelect={auth.selectMode} />
        )}
        {auth.status === 'connecting' && <p>Starting game…</p>}
        {auth.status === 'ready' && <PongCanvas wsToken={auth.wsToken} />}
      </main>
    </div>
  );
}

export default App;
