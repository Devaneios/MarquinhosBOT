import { ErrorScreen } from '@/games/shared/shell';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface ErrorFallbackProps {
  message: string;
  onRetry: () => void;
}

function ErrorFallback({ message, onRetry }: ErrorFallbackProps) {
  const { t } = useTranslation('common');
  return (
    <ErrorScreen
      message={message || t('connectionFailed')}
      onBack={onRetry}
      backLabel={t('tryAgain', { defaultValue: 'Tentar novamente' })}
    />
  );
}

export interface ErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches unexpected React render errors inside the Activity shell so users see
 * a recoverable error state instead of an unmounted blank screen.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(
      '[activity] uncaught render error:',
      error,
      info.componentStack,
    );
  }

  private readonly handleReset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <ErrorFallback
          message={this.state.error.message}
          onRetry={this.handleReset}
        />
      );
    }
    return this.props.children;
  }
}
