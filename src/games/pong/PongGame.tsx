import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { PongCanvas } from './PongCanvas';
import { PongMenuFlow } from './PongMenuFlow';
import { usePongSession } from './usePongSession';

export function PongGame({
  identity,
  onAuthInvalid,
  onExit,
}: {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
  onExit: () => void;
}) {
  const { session, selectMode, backToMenu } = usePongSession(
    identity,
    onAuthInvalid,
  );

  if (session.status === 'selecting-mode') {
    return <PongMenuFlow onSelectMode={selectMode} onExitToHub={onExit} />;
  }

  if (session.status === 'connecting') {
    return (
      <div className="pong-screen pong-status-screen">
        <div className="pong-heading pong-blink-text">STARTING GAME…</div>
      </div>
    );
  }

  if (session.status === 'error') {
    return (
      <div className="pong-screen pong-status-screen">
        <div className="pong-heading pong-status-error">
          CONNECTION FAILED
        </div>
        <div className="pong-status-error-detail">{session.error}</div>
        <button
          type="button"
          className="pong-btn pong-btn-secondary"
          onClick={backToMenu}
        >
          BACK
        </button>
      </div>
    );
  }

  return (
    <PongCanvas
      wsToken={session.wsToken}
      mode={session.mode}
      onMainMenu={backToMenu}
    />
  );
}
