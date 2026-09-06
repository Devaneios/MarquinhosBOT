import { useTranslation } from 'react-i18next';

export interface ErrorScreenProps {
  message: string;
  onRetryAuth?: () => void;
  onBack?: () => void;
  backLabel?: string;
  hint?: string;
}

export function ErrorScreen({
  message,
  onRetryAuth,
  onBack,
  backLabel,
  hint,
}: ErrorScreenProps) {
  const { t } = useTranslation('common');

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="notch-8 flex min-h-[240px] w-full max-w-[560px] flex-col items-center justify-center gap-5 border border-marquinhos-border bg-marquinhos-panel px-8 py-10 text-center shadow-[0_20px_40px_rgba(0,0,0,0.24)]">
        <div className="font-pixel text-lg tracking-[0.24em] text-marquinhos-danger">
          {t('connectionFailed')}
        </div>
        <div className="max-w-[48ch] text-sm leading-6 text-marquinhos-text-dim">
          {message}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {onRetryAuth && (
            <button
              type="button"
              className="notch-6 border border-marquinhos-accent/60 bg-marquinhos-accent px-5 py-3 text-sm font-semibold text-black transition hover:bg-marquinhos-accent-hover"
              onClick={onRetryAuth}
            >
              {t('retryAuth')}
            </button>
          )}
          {onBack && (
            <button
              type="button"
              className="notch-6 border border-marquinhos-border bg-marquinhos-bg px-5 py-3 text-sm text-marquinhos-text transition hover:border-marquinhos-border-hover"
              onClick={onBack}
            >
              {backLabel ?? t('back')}
            </button>
          )}
        </div>
        {hint && (
          <div className="max-w-[48ch] text-xs leading-5 text-marquinhos-text-dim/80">
            {hint}
          </div>
        )}
      </div>
    </div>
  );
}
