export function HowToPlay({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center p-4 sm:p-6">
      <div className="notch-8 flex w-full max-w-[860px] flex-col gap-6 border border-marquinhos-border bg-marquinhos-panel px-6 py-8 shadow-[0_20px_40px_rgba(0,0,0,0.24)] sm:px-8">
        <div className="flex items-start justify-between gap-4">
          <div className="font-pixel text-2xl tracking-[0.24em] text-marquinhos-text">
            HOW TO PLAY
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
              MOVES
            </div>
            <div className="mt-3 text-sm leading-6 text-marquinhos-text-dim">
              Tap a piece, then tap a highlighted square to move it diagonally
              forward one step. Kings (crowned pieces) move diagonally in any
              direction.
            </div>
          </div>
          <div className="notch-6 border border-marquinhos-border bg-black/20 p-5">
            <div className="font-pixel text-sm text-marquinhos-green">
              JUMPS
            </div>
            <div className="mt-3 text-sm leading-6 text-marquinhos-text-dim">
              Jump over an adjacent enemy piece to capture it. If a piece can
              jump again after landing, it must keep jumping before the turn
              passes.
            </div>
          </div>
        </div>

        <div className="notch-6 border border-marquinhos-border bg-black/20 p-5 text-center text-base leading-7 text-marquinhos-accent sm:text-lg">
          JUMPS ARE MANDATORY — IF ANY CAPTURE IS AVAILABLE, YOU MUST TAKE IT.
          REACH THE FAR ROW TO CROWN A KING. WIN BY CAPTURING ALL ENEMY
          PIECES OR LEAVING THEM WITH NO LEGAL MOVE.
        </div>
      </div>
    </div>
  );
}
