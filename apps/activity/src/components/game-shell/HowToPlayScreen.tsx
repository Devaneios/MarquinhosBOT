import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export interface HowToPlaySection {
  headingKey: string;
  headingNs: string;
  body: ReactNode;
}

export interface HowToPlayScreenProps {
  titleKey?: string;
  titleNs?: string;
  sections: HowToPlaySection[];
  footnoteKey?: string;
  footnoteNs?: string;
  onBack: () => void;
}

export function HowToPlayScreen({
  titleKey = 'howToPlay',
  titleNs = 'common',
  sections,
  footnoteKey,
  footnoteNs,
  onBack,
}: HowToPlayScreenProps) {
  const { t } = useTranslation(['common', titleNs, footnoteNs ?? 'common']);

  return (
    <div className="flex flex-1 items-center justify-center p-4 sm:p-6">
      <div className="notch-8 flex w-full max-w-[860px] flex-col gap-6 border border-marquinhos-border bg-marquinhos-panel px-6 py-8 shadow-[0_20px_40px_rgba(0,0,0,0.24)] sm:px-8">
        <div className="flex items-start justify-between gap-4">
          <div className="font-pixel text-2xl tracking-[0.24em] text-marquinhos-text">
            {t(`${titleNs}:${titleKey}`)}
          </div>
          <button
            type="button"
            className="notch-6 border border-marquinhos-border bg-marquinhos-bg px-4 py-2 text-xs uppercase tracking-[0.2em] text-marquinhos-text-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent"
            onClick={onBack}
          >
            {t('common:back')}
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {sections.map((section, index) => (
            <div
              key={index}
              className="notch-6 border border-marquinhos-border bg-black/20 p-5"
            >
              <div className="font-pixel text-sm text-marquinhos-accent">
                {t(`${section.headingNs}:${section.headingKey}`)}
              </div>
              <div className="mt-4 text-marquinhos-text-dim">
                {section.body}
              </div>
            </div>
          ))}
        </div>

        {footnoteKey && (
          <div className="notch-6 border border-marquinhos-border bg-black/20 p-5 text-center text-base leading-7 text-marquinhos-accent sm:text-lg">
            {t(`${footnoteNs ?? titleNs}:${footnoteKey}`)}
          </div>
        )}
      </div>
    </div>
  );
}
