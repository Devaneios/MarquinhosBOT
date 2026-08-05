import { useNavigate } from 'react-router-dom';
import { GAME_REGISTRY } from '../games/registry';
import { cn } from '../lib/cn';

export function Hub() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-11 p-7">
      <div className="font-pixel animate-pixel-glow text-4xl tracking-widest text-marquinhos-accent">
        MARQUINHOS
      </div>
      <div className="flex max-w-[760px] flex-wrap justify-center gap-6">
        {GAME_REGISTRY.map((game) => {
          const locked = game.status !== 'PLAY';
          return (
            <button
              key={game.id}
              type="button"
              disabled={locked}
              className={cn(
                'notch-8 flex w-[220px] flex-col items-center gap-3.5 border border-marquinhos-border bg-marquinhos-panel px-4.5 py-7 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent',
                locked
                  ? 'cursor-not-allowed'
                  : 'cursor-pointer hover:border-marquinhos-border-hover',
              )}
              onClick={() => {
                if (locked) return;
                console.log('[hub] launching game', game.id);
                navigate(`/games/${game.id}`);
              }}
            >
              <div
                className={cn(
                  'font-mono text-sm font-semibold tracking-wide',
                  locked ? 'text-marquinhos-text-disabled' : 'text-marquinhos-text',
                )}
              >
                {game.name}
              </div>
              <div className="text-sm text-marquinhos-text-dim">
                {game.status}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
