import { useTranslation } from 'react-i18next';
import { MenuAction } from './MenuAction';
import { MenuPanel } from './MenuPanel';

export interface EndScreenProps {
  outcomeKey: string;
  outcomeNs: string;
  onPlayAgain?: () => void;
  onBackToHub: () => void;
}

export function EndScreen({
  outcomeKey,
  outcomeNs,
  onPlayAgain,
  onBackToHub,
}: EndScreenProps) {
  const { t } = useTranslation([outcomeNs, 'common']);

  return (
    <div className="flex h-full w-full items-center justify-center p-4 sm:p-6">
      <MenuPanel className="w-full max-w-130 px-6 py-10 text-center sm:px-8">
        <div className="font-pixel text-lg tracking-[0.24em] text-marquinhos-accent">
          {t(`${outcomeNs}:${outcomeKey}`)}
        </div>
        <div className="mx-auto mt-6 flex max-w-80 flex-col gap-3">
          {onPlayAgain && (
            <MenuAction
              variant="primary"
              label={t('common:playAgain')}
              onSelect={onPlayAgain}
            />
          )}
          <MenuAction label={t('common:backToHub')} onSelect={onBackToHub} />
        </div>
      </MenuPanel>
    </div>
  );
}
