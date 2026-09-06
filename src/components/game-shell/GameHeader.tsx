import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export interface GameHeaderProps {
  titleKey: string;
  titleNs: string;
  onBack?: () => void;
  backLabel?: string;
  right?: ReactNode;
  variant?: 'bar' | 'minimal';
}

export function GameHeader({
  titleKey,
  titleNs,
  onBack,
  backLabel,
  right,
  variant = 'bar',
}: GameHeaderProps) {
  const { t } = useTranslation([titleNs, 'common']);
  const title = t(`${titleNs}:${titleKey}`);
  const label = backLabel ?? t('common:back');

  if (variant === 'minimal') {
    return (
      <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="font-pixel text-xs tracking-[0.24em] text-marquinhos-accent sm:text-sm">
          {title}
        </div>
        <div className="flex items-center gap-3">
          {right}
          {onBack && (
            <button
              type="button"
              className="font-pixel text-[11px] uppercase tracking-[0.2em] text-marquinhos-text-dim transition hover:text-marquinhos-text"
              onClick={onBack}
            >
              {label}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <header className="flex items-center justify-between gap-4 border-b border-marquinhos-border bg-black/10 px-4 py-3 sm:px-6">
      <div className="min-w-0">
        <div className="font-pixel text-sm tracking-[0.28em] text-marquinhos-accent sm:text-base">
          {title}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {right}
        {onBack && (
          <button
            type="button"
            className="notch-6 border border-marquinhos-border bg-marquinhos-panel px-4 py-2 text-xs uppercase tracking-[0.2em] text-marquinhos-text-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent"
            onClick={onBack}
          >
            {label}
          </button>
        )}
      </div>
    </header>
  );
}
