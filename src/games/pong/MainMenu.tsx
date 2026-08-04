const btnBase =
  'notch-6 cursor-pointer border font-mono text-xs tracking-wide px-6 py-4.5 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent';
const btnPrimary = `${btnBase} border-marquinhos-accent bg-marquinhos-accent text-marquinhos-bg hover:bg-marquinhos-accent-hover`;
const btnSecondary = `${btnBase} border-marquinhos-border bg-marquinhos-panel text-marquinhos-text hover:border-marquinhos-border-hover`;

export function MainMenu({
  onPlay,
  onSettings,
  onHowTo,
  onExitToHub,
}: {
  onPlay: () => void;
  onSettings: () => void;
  onHowTo: () => void;
  onExitToHub: () => void;
}) {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-12">
      <div className="flex flex-col items-center gap-3.5">
        <div className="font-pixel animate-pixel-glow text-4xl tracking-widest text-marquinhos-accent">
          PONGUINHOS
        </div>
        <div className="font-pixel animate-pong-blink text-xs text-marquinhos-text-dim">
          PRESS PLAY TO START
        </div>
      </div>
      <button
        type="button"
        className="font-pixel absolute top-6 left-10 cursor-pointer border-none bg-none text-[11px] text-marquinhos-text-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent"
        onClick={onExitToHub}
      >
        &lt; ARCADE
      </button>
      <div className="flex w-[340px] flex-col gap-4.5">
        <button type="button" className={btnPrimary} onClick={onPlay}>
          PLAY
        </button>
        <button type="button" className={btnSecondary} onClick={onSettings}>
          SETTINGS
        </button>
        <button type="button" className={btnSecondary} onClick={onHowTo}>
          HOW TO PLAY
        </button>
      </div>
      <div className="text-lg text-marquinhos-text-dim">
        © 2026 ARCADE PIXEL STUDIOS
      </div>
    </div>
  );
}
