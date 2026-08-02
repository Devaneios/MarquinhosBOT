import './App.css';
import './games/pong/pong-theme.css';
import { PongCanvas } from './games/pong/PongCanvas';
import { PongMenuFlow } from './games/pong/PongMenuFlow';
import { useDiscordAuth } from './hooks/useDiscordAuth';

function App() {
  const auth = useDiscordAuth();

  return (
    <div className="pong-shell">
      {auth.status === 'loading' && (
        <div className="pong-screen pong-status-screen">
          <div className="pong-heading pong-blink-text">CONNECTING…</div>
        </div>
      )}
      {auth.status === 'error' && (
        <div className="pong-screen pong-status-screen">
          <div className="pong-heading pong-status-error">
            CONNECTION FAILED
          </div>
          <div className="pong-status-error-detail">{auth.error}</div>
        </div>
      )}
      {auth.status === 'selecting-mode' && (
        <PongMenuFlow onSelectMode={auth.selectMode} />
      )}
      {auth.status === 'connecting' && (
        <div className="pong-screen pong-status-screen">
          <div className="pong-heading pong-blink-text">STARTING GAME…</div>
        </div>
      )}
      {auth.status === 'ready' && (
        <PongCanvas wsToken={auth.wsToken} mode={auth.mode} />
      )}
    </div>
  );
}

export default App;
