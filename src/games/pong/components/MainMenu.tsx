import { useTranslation } from 'react-i18next';

const btnBase =
  'notch-6 cursor-pointer border font-mono text-xs tracking-wide px-6 py-4.5 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent';
const btnPrimary = `${btnBase} border-marquinhos-accent bg-marquinhos-accent text-marquinhos-bg hover:bg-marquinhos-accent-hover`;
const btnSecondary = `${btnBase} border-marquinhos-border bg-marquinhos-panel text-marquinhos-text hover:border-marquinhos-border-hover`;

export function MainMenu({
  onPlay,
  onSettings,
  onHowTo,
  onCompetitive,
  onExitToHub,
}: {
  onPlay: () => void;
  onSettings: () => void;
  onHowTo: () => void;
  onCompetitive: () => void;
  onExitToHub: () => void;
}) {
  const { t } = useTranslation(['pong', 'common', 'games']);

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,176,0,0.12),_transparent_30%),linear-gradient(180deg,_rgba(255,255,255,0.02),_transparent_20%),var(--color-marquinhos-bg)]">
      <button
        type="button"
        className="font-pixel absolute left-4 top-4 z-10 cursor-pointer border-none bg-none text-[11px] text-marquinhos-text-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent sm:left-6 sm:top-6"
        onClick={onExitToHub}
      >
        &lt; {t('common:backToHub')}
      </button>

      <div className="flex flex-1 items-center justify-center p-4 sm:p-6">
        <div className="notch-8 flex w-full max-w-[720px] flex-col items-center gap-7 border border-marquinhos-border bg-marquinhos-panel px-6 py-10 text-center shadow-[0_20px_40px_rgba(0,0,0,0.28)] sm:px-8">
          <div className="flex flex-col items-center gap-3.5">
            <div className="font-pixel animate-pixel-glow text-4xl tracking-widest text-marquinhos-accent">
              {t('games:pong.name')}
            </div>
            <div className="font-pixel animate-pong-blink text-xs text-marquinhos-text-dim">
              {t('pressPlayToStart')}
            </div>
          </div>

          <div className="grid w-full gap-3 sm:max-w-[420px]">
            <button type="button" className={btnPrimary} onClick={onPlay}>
              {t('common:play')}
            </button>
            <button type="button" className={btnSecondary} onClick={onSettings}>
              {t('common:settings')}
            </button>
            <button
              type="button"
              className={btnSecondary}
              onClick={onCompetitive}
            >
              {t('competitive')}
            </button>
            <button type="button" className={btnSecondary} onClick={onHowTo}>
              {t('common:howToPlay')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
