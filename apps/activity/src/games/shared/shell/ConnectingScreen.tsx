import { ViewTransition, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { MenuPanel } from './menu/MenuPanel';

export interface ConnectingScreenProps {
  subtitleKey?: string;
  subtitleNs?: string;
  /** Game-specific loading visual; demotes the label to a caption. */
  children?: ReactNode;
}

export function ConnectingScreen({
  subtitleKey,
  subtitleNs = 'common',
  children,
}: ConnectingScreenProps) {
  const { t } = useTranslation([subtitleNs, 'common']);
  const subtitle = subtitleKey ? t(`${subtitleNs}:${subtitleKey}`) : null;

  return (
    <div className="flex flex-1 items-center justify-center p-4 sm:p-6">
      <ViewTransition name="game-panel">
        <MenuPanel className="w-full max-w-130 px-6 py-10 text-center sm:px-8">
          {children ? (
            <>
              <div aria-hidden="true">{children}</div>
              <div
                role="status"
                className="font-pixel mt-6 text-[10px] tracking-[0.28em] text-marquinhos-text-dim"
              >
                {t('common:connecting')}
              </div>
            </>
          ) : (
            <>
              <div className="font-pixel animate-pong-blink text-sm tracking-[0.28em] text-marquinhos-accent">
                {t('common:connecting')}
              </div>
              {subtitle && (
                <p className="mx-auto mt-4 max-w-[36ch] text-sm leading-6 text-marquinhos-text-dim">
                  {subtitle}
                </p>
              )}
            </>
          )}
        </MenuPanel>
      </ViewTransition>
    </div>
  );
}
