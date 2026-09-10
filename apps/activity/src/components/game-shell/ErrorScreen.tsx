import { useTranslation } from 'react-i18next';
import { MenuAction } from './MenuAction';
import { MenuPanel } from './MenuPanel';

export interface ErrorScreenProps {
  message: string;
  onRetryAuth?: () => void;
  onBack?: () => void;
  backLabel?: string;
  hint?: string;
}

export function ErrorScreen({
  message,
  onRetryAuth,
  onBack,
  backLabel,
  hint,
}: ErrorScreenProps) {
  const { t } = useTranslation('common');

  return (
    <div className="flex flex-1 items-center justify-center p-4 sm:p-6">
      <MenuPanel className="w-full max-w-140 px-6 py-10 text-center sm:px-8">
        <div className="font-pixel text-lg tracking-[0.24em] text-marquinhos-danger">
          {t('connectionFailed')}
        </div>
        <p className="mx-auto mt-4 max-w-[48ch] text-sm leading-6 text-marquinhos-text-dim">
          {message}
        </p>
        {(onRetryAuth || onBack) && (
          <div className="mx-auto mt-6 flex max-w-80 flex-col gap-3">
            {onRetryAuth && (
              <MenuAction
                variant="primary"
                label={t('retryAuth')}
                onSelect={onRetryAuth}
              />
            )}
            {onBack && (
              <MenuAction label={backLabel ?? t('back')} onSelect={onBack} />
            )}
          </div>
        )}
        {hint && (
          <p className="mx-auto mt-6 max-w-[48ch] text-xs leading-5 text-marquinhos-text-dim/80">
            {hint}
          </p>
        )}
      </MenuPanel>
    </div>
  );
}
