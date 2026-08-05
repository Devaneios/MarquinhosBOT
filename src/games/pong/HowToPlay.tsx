const key =
  'font-pixel flex h-11 w-11 items-center justify-center border border-marquinhos-border bg-marquinhos-panel text-sm text-marquinhos-text';

export function HowToPlay({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center p-4 sm:p-6">
      <div className="notch-8 flex w-full max-w-[860px] flex-col gap-6 border border-marquinhos-border bg-marquinhos-panel px-6 py-8 shadow-[0_20px_40px_rgba(0,0,0,0.24)] sm:px-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-pixel text-2xl tracking-[0.24em] text-marquinhos-text">
              HOW TO PLAY
            </div>
            <div className="mt-2 text-sm leading-6 text-marquinhos-text-dim">
              Controls are presented with the same notched, panel-based visual
              style as the rest of the app.
            </div>
          </div>
          <button
            type="button"
            className="notch-6 border border-marquinhos-border bg-marquinhos-bg px-4 py-2 text-xs uppercase tracking-[0.2em] text-marquinhos-text-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent"
            onClick={onBack}
          >
            Back
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="notch-6 border border-marquinhos-border bg-black/20 p-5">
            <div className="font-pixel text-sm text-marquinhos-accent">
              PLAYER 1
            </div>
            <div className="mt-4 flex flex-col items-center gap-1.5">
              <div className={key}>W</div>
              <div className={key}>S</div>
            </div>
            <div className="mt-4 text-center text-lg text-marquinhos-text-dim">
              MOVE UP / DOWN
            </div>
          </div>
          <div className="notch-6 border border-marquinhos-border bg-black/20 p-5">
            <div className="font-pixel text-sm text-marquinhos-green">
              PLAYER 2
            </div>
            <div className="mt-4 flex flex-col items-center gap-1.5">
              <div className={key}>▲</div>
              <div className={key}>▼</div>
            </div>
            <div className="mt-4 text-center text-lg text-marquinhos-text-dim">
              MOVE UP / DOWN
            </div>
          </div>
        </div>

        <div className="notch-6 border border-marquinhos-border bg-black/20 p-5 text-center text-base leading-7 text-marquinhos-accent sm:text-lg">
          VS CPU OR VS FRIEND USES ARROW KEYS ONLY. FIRST TO REACH THE TARGET
          SCORE WINS. PRESS ESC TO PAUSE MID-MATCH.
        </div>
      </div>
    </div>
  );
}
