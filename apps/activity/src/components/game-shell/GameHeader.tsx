import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { backChipClass } from './menuButtons';

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

  return (
    <header
      className={
        variant === 'minimal'
          ? 'flex items-center justify-between gap-4 px-4 py-3 sm:px-6'
          : 'flex items-center justify-between gap-4 border-b border-marquinhos-border bg-black/10 px-4 py-3 sm:px-6'
      }
    >
      <div className="min-w-0">
        <div className="truncate font-pixel text-sm tracking-[0.28em] text-marquinhos-accent sm:text-base">
          {title}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {right}
        {onBack && (
          <button type="button" className={backChipClass} onClick={onBack}>
            {label}
          </button>
        )}
      </div>
    </header>
  );
}
