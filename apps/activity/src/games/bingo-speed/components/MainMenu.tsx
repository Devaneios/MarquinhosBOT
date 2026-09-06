import { useTranslation } from 'react-i18next';

export function MainMenu({
  onPlay,
  onExitToHub,
}: {
  onPlay: () => void;
  onExitToHub: () => void;
}) {
  const { t } = useTranslation(['games', 'common']);

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="notch-8 flex w-full max-w-[480px] flex-col gap-6 border border-marquinhos-border bg-marquinhos-panel px-8 py-10 shadow-[0_20px_40px_rgba(0,0,0,0.24)]">
        <div className="font-pixel text-2xl tracking-[0.24em] text-marquinhos-accent">
          {t('games:bingo-speed.name')}
        </div>

        <div className="text-sm leading-6 text-marquinhos-text-dim">
          {t('games:bingo-speed.blurb')}
        </div>

        <button
          type="button"
          className="notch-6 border border-marquinhos-accent/60 bg-marquinhos-accent py-4 font-semibold text-black transition hover:bg-marquinhos-accent-hover"
          onClick={onPlay}
        >
          {t('common:play')}
        </button>

        <button
          type="button"
          className="notch-6 border border-marquinhos-border px-6 py-3 font-semibold text-marquinhos-text transition hover:bg-marquinhos-panel"
          onClick={onExitToHub}
        >
          {t('common:backToHub')}
        </button>
      </div>
    </div>
  );
}
