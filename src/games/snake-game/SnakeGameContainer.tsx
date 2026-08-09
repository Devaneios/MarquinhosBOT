import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { SnakeCanvas } from './SnakeCanvas';
import { useSnakeSession } from './useSnakeSession';

export function SnakeGameContainer({
  identity,
  onAuthInvalid,
}: {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
}) {
  const { session, selectMode, backToMenu } = useSnakeSession(
    identity,
    onAuthInvalid,
  );

  if (session.status === 'selecting-mode') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 bg-marquinhos-bg text-marquinhos-text">
        <h1 className="font-pixel text-2xl">SNAKE GAME</h1>
        <div className="flex gap-5">
          <button
            type="button"
            className="notch-6 cursor-pointer border border-marquinhos-accent bg-marquinhos-accent px-6 py-4 font-mono text-xs tracking-wide text-marquinhos-bg hover:bg-marquinhos-accent-hover"
            onClick={() => selectMode('single')}
          >
            SINGLE PLAYER
          </button>
          <button
            type="button"
            className="notch-6 cursor-pointer border border-marquinhos-border bg-marquinhos-panel px-6 py-4 font-mono text-xs tracking-wide text-marquinhos-text hover:border-marquinhos-border-hover"
            onClick={() => selectMode('multi')}
          >
            TWO PLAYER
          </button>
        </div>
      </div>
    );
  }

  if (session.status === 'connecting') {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="notch-8 flex min-h-[240px] w-full max-w-[520px] flex-col items-center justify-center gap-4 border border-marquinhos-border bg-marquinhos-panel px-8 py-10 text-center shadow-[0_20px_40px_rgba(0,0,0,0.24)]">
          <div className="font-pixel text-sm tracking-[0.28em] text-marquinhos-accent">
            STARTING GAME…
          </div>
        </div>
      </div>
    );
  }

  if (session.status === 'error') {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="notch-8 flex min-h-[240px] w-full max-w-[560px] flex-col items-center justify-center gap-5 border border-marquinhos-border bg-marquinhos-panel px-8 py-10 text-center shadow-[0_20px_40px_rgba(0,0,0,0.24)]">
          <div className="font-pixel text-lg tracking-[0.24em] text-marquinhos-danger">
            CONNECTION FAILED
          </div>
          <div className="max-w-[48ch] text-sm leading-6 text-marquinhos-text-dim">
            {session.error}
          </div>
          <button
            type="button"
            className="notch-6 border border-marquinhos-accent/60 bg-marquinhos-accent px-5 py-3 text-sm font-semibold text-black transition hover:bg-marquinhos-accent-hover"
            onClick={backToMenu}
          >
            BACK
          </button>
        </div>
      </div>
    );
  }

  return (
    <SnakeCanvas
      session={session.session}
      mode={session.mode}
      onMainMenu={backToMenu}
    />
  );
}
