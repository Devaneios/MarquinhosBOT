import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { GameHeader } from './GameHeader';

export interface MenuScreenProps {
  titleKey: string;
  titleNs: string;
  headingKey: string;
  headingNs: string;
  onBack?: () => void;
  backLabel?: string;
  headerRight?: ReactNode;
  children: ReactNode;
}

// The shared frame for every out-of-match screen: the same header bar,
// scroll region, content column and accent-barred page heading the Hub uses,
// so a game menu reads as the same product as the Hub that linked to it.
export function MenuScreen({
  titleKey,
  titleNs,
  headingKey,
  headingNs,
  onBack,
  backLabel,
  headerRight,
  children,
}: MenuScreenProps) {
  const { t } = useTranslation([headingNs, 'common']);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top_right,rgba(255,176,0,0.06),transparent_55%),var(--color-marquinhos-bg)] text-marquinhos-text">
      <GameHeader
        titleKey={titleKey}
        titleNs={titleNs}
        onBack={onBack}
        backLabel={backLabel}
        right={headerRight}
      />

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 md:py-10 [@media(max-height:600px)]:py-4">
        <div className="mx-auto flex w-full max-w-280 flex-col gap-6 md:gap-8 [@media(max-height:600px)]:gap-5">
          <div className="flex items-start gap-3 md:gap-4">
            <span
              aria-hidden="true"
              className="mt-1.5 h-6 w-1 shrink-0 bg-marquinhos-accent md:mt-2 md:h-7"
            />
            <h1 className="max-w-160 text-xl font-semibold leading-snug tracking-tight text-balance sm:text-2xl md:text-3xl">
              {t(`${headingNs}:${headingKey}`)}
            </h1>
          </div>

          {children}
        </div>
      </main>
    </div>
  );
}
