import './App.css';
import { PongCanvas } from './games/pong/PongCanvas';
import { useDiscordAuth } from './hooks/useDiscordAuth';

function App() {
  const auth = useDiscordAuth();

  if (auth.status === 'loading') {
    return (
      <div className="status">
        <p>Connecting to Discord…</p>
      </div>
    );
  }

  if (auth.status === 'error') {
    return (
      <div className="status">
        <p>Failed to connect: {auth.error}</p>
      </div>
    );
  }

  return (
    <div className="app">
      <PongCanvas wsToken={auth.wsToken} />
    </div>
  );
}

export default App;
