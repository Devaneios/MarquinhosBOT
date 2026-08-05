import { Outlet, useNavigate } from 'react-router-dom';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { PongCanvas } from './PongCanvas';
import type { PongMenuOutletContext } from './PongMenuFlow';
import { usePongSession } from './usePongSession';

export function PongGame({
  identity,
  onAuthInvalid,
}: {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
}) {
  const navigate = useNavigate();
  const { session, selectMode, backToMenu } = usePongSession(
    identity,
    onAuthInvalid,
  );

  function toMainMenu() {
    backToMenu();
    navigate('/games/pong', { replace: true });
  }

  if (session.status === 'selecting-mode') {
    return (
      <Outlet
        context={
          {
            onSelectMode: selectMode,
            onExitToHub: () => navigate('/'),
          } satisfies PongMenuOutletContext
        }
      />
    );
  }

  if (session.status === 'connecting') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <div className="font-pixel animate-pong-blink text-sm text-marquinhos-accent">
          STARTING GAME…
        </div>
      </div>
    );
  }

  if (session.status === 'error') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <div className="font-pixel text-lg text-marquinhos-danger">
          CONNECTION FAILED
        </div>
        <div className="max-w-[480px] text-center text-marquinhos-text-dim">
          {session.error}
        </div>
        <button
          type="button"
          className="notch-6 cursor-pointer border border-marquinhos-border bg-marquinhos-panel px-6 py-4.5 font-mono text-xs tracking-wide text-marquinhos-text hover:border-marquinhos-border-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent"
          onClick={toMainMenu}
        >
          BACK
        </button>
      </div>
    );
  }

  return (
    <PongCanvas
      session={session.session}
      mode={session.mode}
      sound={session.sound}
      onMainMenu={toMainMenu}
    />
  );
}
