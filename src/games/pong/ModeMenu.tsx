import type { GameMode } from './types';

const modeCard =
  'notch-8 flex w-[260px] cursor-pointer flex-col items-center gap-4 border border-marquinhos-border bg-marquinhos-panel px-5 py-8 text-center text-marquinhos-text hover:border-marquinhos-border-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent';

export function ModeMenu({
  onSelect,
  onBack,
}: {
  onSelect: (mode: GameMode) => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-12">
      <div className="font-pixel text-2xl text-marquinhos-text">
        SELECT MODE
      </div>
      <div className="flex flex-wrap justify-center gap-7">
        <button
          type="button"
          className={modeCard}
          onClick={() => onSelect('single')}
        >
          <div className="font-pixel text-sm text-marquinhos-accent">
            1 PLAYER
          </div>
          <div className="text-lg text-marquinhos-text-dim">VS CPU</div>
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
        </button>
        <button
          type="button"
          className={modeCard}
          onClick={() => onSelect('local')}
        >
          <div className="font-pixel text-sm text-marquinhos-text">
            LOCAL 2P
          </div>
          <div className="text-lg text-marquinhos-text-dim">SAME DEVICE</div>
        </button>
      </div>
      <button
        type="button"
        className="font-pixel mt-2 cursor-pointer border-none bg-none p-1 text-xs text-marquinhos-text-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent"
        onClick={onBack}
      >
        &lt; BACK
      </button>
    </div>
  );
}
