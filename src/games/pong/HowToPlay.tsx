const key =
  'font-pixel flex h-11 w-11 items-center justify-center border border-marquinhos-border bg-marquinhos-panel text-sm text-marquinhos-text';

export function HowToPlay({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-12">
      <div className="font-pixel text-2xl text-marquinhos-text">
        HOW TO PLAY
      </div>
      <div className="flex gap-16">
        <div className="flex flex-col items-center gap-4">
          <div className="font-pixel text-sm text-marquinhos-accent">
            PLAYER 1
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className={key}>W</div>
            <div className={key}>S</div>
          </div>
          <div className="text-lg text-marquinhos-text-dim">MOVE UP / DOWN</div>
        </div>
        <div className="flex flex-col items-center gap-4">
          <div className="font-pixel text-sm text-marquinhos-green">
            PLAYER 2
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className={key}>▲</div>
            <div className={key}>▼</div>
          </div>
          <div className="text-lg text-marquinhos-text-dim">MOVE UP / DOWN</div>
        </div>
      </div>
      <div className="max-w-[480px] text-center text-xl text-marquinhos-accent">
        VS CPU OR VS FRIEND USES ARROW KEYS ONLY. FIRST TO REACH THE TARGET
        SCORE WINS. PRESS ESC TO PAUSE MID-MATCH.
      </div>
      <button
        type="button"
        className="font-pixel cursor-pointer border-none bg-none p-1 text-xs text-marquinhos-text-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent"
        onClick={onBack}
      >
        &lt; BACK
      </button>
    </div>
  );
}
