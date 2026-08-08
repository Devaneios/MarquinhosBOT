export function ModeMenu({
  onSelect,
  onBack,
}: {
  onSelect: (mode: 'multi' | 'single') => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="notch-8 flex w-full max-w-[480px] flex-col gap-6 border border-marquinhos-border bg-marquinhos-panel px-8 py-10 shadow-[0_20px_40px_rgba(0,0,0,0.24)]">
        <div className="font-pixel text-lg tracking-[0.24em] text-marquinhos-accent">
          SELECT MODE
        </div>

        <button
          type="button"
          className="notch-6 border border-marquinhos-accent/60 bg-marquinhos-accent py-4 font-semibold text-black transition hover:bg-marquinhos-accent-hover"
          onClick={() => onSelect('multi')}
        >
          MULTIPLAYER
        </button>

        <button
          type="button"
          className="notch-6 border border-marquinhos-accent/60 bg-marquinhos-accent py-4 font-semibold text-black transition hover:bg-marquinhos-accent-hover"
          onClick={() => onSelect('single')}
        >
          SINGLE PLAYER
        </button>

        <button
          type="button"
          className="notch-6 border border-marquinhos-border px-6 py-3 font-semibold text-marquinhos-text transition hover:bg-marquinhos-panel"
          onClick={onBack}
        >
          BACK
        </button>
      </div>
    </div>
  );
}
