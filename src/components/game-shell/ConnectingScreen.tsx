import { useTranslation } from 'react-i18next';

export interface ConnectingScreenProps {
  subtitleKey?: string;
  subtitleNs?: string;
}

export function ConnectingScreen({
  subtitleKey,
  subtitleNs = 'common',
}: ConnectingScreenProps) {
  const { t } = useTranslation([subtitleNs, 'common']);
  const subtitle = subtitleKey ? t(`${subtitleNs}:${subtitleKey}`) : null;

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="notch-8 flex min-h-60 w-full max-w-130 flex-col items-center justify-center gap-4 border border-marquinhos-border bg-marquinhos-panel px-8 py-10 text-center shadow-[0_20px_40px_rgba(0,0,0,0.24)]">
        <div className="font-pixel animate-pong-blink text-sm tracking-[0.28em] text-marquinhos-accent">
          {t('common:connecting')}
        </div>
        {subtitle && (
          <div className="max-w-[36ch] text-sm leading-6 text-marquinhos-text-dim">
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
