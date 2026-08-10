import { useTranslation } from 'react-i18next';

export interface EndScreenProps {
  outcomeKey: string;
  outcomeNs: string;
  onPlayAgain?: () => void;
  onBackToHub: () => void;
}

export function EndScreen({
  outcomeKey,
  outcomeNs,
  onPlayAgain,
  onBackToHub,
}: EndScreenProps) {
  const { t } = useTranslation([outcomeNs, 'common']);

  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <div className="notch-8 flex min-h-[220px] w-full max-w-[520px] flex-col items-center justify-center gap-6 border border-marquinhos-border bg-marquinhos-panel px-8 py-10 text-center shadow-[0_20px_40px_rgba(0,0,0,0.28)]">
        <div className="font-pixel text-xl tracking-[0.24em] text-marquinhos-text">
          {t(`${outcomeNs}:${outcomeKey}`)}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {onPlayAgain && (
            <button
              type="button"
              className="notch-6 border border-marquinhos-accent/60 bg-marquinhos-accent px-5 py-3 text-sm font-semibold text-black transition hover:bg-marquinhos-accent-hover"
              onClick={onPlayAgain}
            >
              {t('common:playAgain')}
            </button>
          )}
          <button
            type="button"
            className="notch-6 border border-marquinhos-border bg-marquinhos-bg px-5 py-3 text-sm text-marquinhos-text transition hover:border-marquinhos-border-hover"
            onClick={onBackToHub}
          >
            {t('common:backToHub')}
          </button>
        </div>
      </div>
    </div>
  );
}
