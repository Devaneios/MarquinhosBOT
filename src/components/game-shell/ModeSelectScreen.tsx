import { useTranslation } from 'react-i18next';

export interface ModeOption {
  key: string;
  labelKey: string;
  labelNs: string;
  onSelect: () => void;
}

export interface ModeSelectScreenProps {
  titleKey?: string;
  titleNs?: string;
  options: ModeOption[];
  onBack: () => void;
}

export function ModeSelectScreen({
  titleKey = 'selectMode',
  titleNs = 'common',
  options,
  onBack,
}: ModeSelectScreenProps) {
  const { t } = useTranslation(['common', titleNs]);

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="notch-8 flex min-h-60 w-full max-w-130 flex-col items-center justify-center gap-4 border border-marquinhos-border bg-marquinhos-panel px-8 py-10 text-center shadow-[0_20px_40px_rgba(0,0,0,0.24)]">
        <div className="font-pixel text-lg tracking-[0.24em] text-marquinhos-accent">
          {t(`${titleNs}:${titleKey}`)}
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          {options.map((option) => (
            <button
              key={option.key}
              type="button"
              className="notch-6 border border-marquinhos-accent/60 bg-marquinhos-accent px-5 py-3 text-sm font-semibold text-black transition hover:bg-marquinhos-accent-hover"
              onClick={option.onSelect}
            >
              {t(`${option.labelNs}:${option.labelKey}`)}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="notch-6 border border-marquinhos-border bg-transparent px-5 py-3 text-sm font-semibold text-marquinhos-text transition hover:bg-marquinhos-panel"
          onClick={onBack}
        >
          {t('common:back')}
        </button>
      </div>
    </div>
  );
}
