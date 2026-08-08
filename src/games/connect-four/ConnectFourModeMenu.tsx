import type { GameMode } from './types';

const modeCard =
  'notch-8 flex w-full cursor-pointer flex-col items-center gap-4 border border-marquinhos-border bg-marquinhos-panel px-5 py-8 text-center text-marquinhos-text hover:border-marquinhos-border-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent';

export function ConnectFourModeMenu({
  onSelect,
  onExitToHub,
}: {
  onSelect: (mode: GameMode) => void;
  onExitToHub: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-4 sm:p-6">
      <div className="notch-8 flex w-full max-w-[720px] flex-col gap-6 border border-marquinhos-border bg-marquinhos-panel px-6 py-8 shadow-[0_20px_40px_rgba(0,0,0,0.24)] sm:px-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-pixel text-2xl tracking-[0.24em] text-marquinhos-text">
              CONNECT FOUR
            </div>
            <div className="mt-2 text-sm leading-6 text-marquinhos-text-dim">
              Pick how you want to play the match.
            </div>
          </div>
          <button
            type="button"
            className="notch-6 border border-marquinhos-border bg-marquinhos-bg px-4 py-2 text-xs uppercase tracking-[0.2em] text-marquinhos-text-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent"
            onClick={onExitToHub}
          >
            Back
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <button
            type="button"
            className={modeCard}
            onClick={() => onSelect('single')}
          >
            <div className="font-pixel text-sm text-marquinhos-accent">
              1 PLAYER
            </div>
            <div className="text-lg text-marquinhos-text-dim">VS CPU</div>
            <div className="text-sm leading-6 text-marquinhos-text-dim">
              Drop discs against a heuristic bot opponent.
            </div>
          </button>
          <button
            type="button"
            className={modeCard}
            onClick={() => onSelect('multi')}
          >
            <div className="font-pixel text-sm text-marquinhos-green">
              2 PLAYERS
            </div>
            <div className="text-lg text-marquinhos-text-dim">VS FRIEND</div>
            <div className="text-sm leading-6 text-marquinhos-text-dim">
              A shared match driven by the realtime backend.
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
