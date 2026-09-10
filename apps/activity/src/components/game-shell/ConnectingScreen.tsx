import { useTranslation } from 'react-i18next';
import { MenuPanel } from './MenuPanel';

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
    <div className="flex flex-1 items-center justify-center p-4 sm:p-6">
      <MenuPanel className="w-full max-w-130 px-6 py-10 text-center sm:px-8">
        <div className="font-pixel animate-pong-blink text-sm tracking-[0.28em] text-marquinhos-accent">
          {t('common:connecting')}
        </div>
        {subtitle && (
          <p className="mx-auto mt-4 max-w-[36ch] text-sm leading-6 text-marquinhos-text-dim">
            {subtitle}
          </p>
        )}
      </MenuPanel>
    </div>
  );
}
