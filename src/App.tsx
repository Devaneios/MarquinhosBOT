import './App.css';
import './games/pong/pong-theme.css';
import { Hub } from './hub/Hub';
import { useDiscordIdentity } from './hooks/useDiscordIdentity';

function App() {
  const identity = useDiscordIdentity();

  return (
    <div className="pong-shell">
      {identity.status === 'loading' && (
        <div className="pong-screen pong-status-screen">
          <div className="pong-heading pong-blink-text">CONNECTING…</div>
        </div>
      )}
      {identity.status === 'error' && (
        <div className="pong-screen pong-status-screen">
          <div className="pong-heading pong-status-error">
            CONNECTION FAILED
          </div>
          <div className="pong-status-error-detail">{identity.error}</div>
        </div>
      )}
      {identity.status === 'ready' && (
        <Hub identity={identity.identity} onAuthInvalid={identity.reauth} />
      )}
    </div>
  );
}

export default App;
