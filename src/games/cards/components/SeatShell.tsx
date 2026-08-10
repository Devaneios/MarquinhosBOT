import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/cn';

export function SeatShell({
  title,
  occupied,
  active,
  children,
}: {
  title: string;
  occupied?: boolean;
  active?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation('cards');

  return (
    <div
      className={cn(
        'notch-8 flex min-h-[128px] flex-col justify-between border bg-marquinhos-panel p-3.5 shadow-[0_12px_24px_rgba(0,0,0,0.22)]',
        occupied
          ? 'border-marquinhos-border'
          : 'border-dashed border-marquinhos-border/70',
        active && 'border-marquinhos-green/70 ring-2 ring-marquinhos-green/35',
      )}
    >
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.24em] text-marquinhos-text-dim">
        <span>{title}</span>
        <span>{occupied ? t('cards:occupiedLabel') : t('cards:emptyLabel')}</span>
      </div>
      <div className="mt-3 flex-1">{children}</div>
    </div>
  );
}
