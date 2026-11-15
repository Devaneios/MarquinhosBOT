import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import { ErrorBoundary } from './ErrorBoundary';

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('boom-in-render');
  }
  return <div data-testid="healthy">ok</div>;
}

describe('ErrorBoundary', () => {
  afterEach(() => {
    cleanup();
  });

  it('catches synchronous render errors and recovers on retry', () => {
    const spy = spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      let shouldThrow = true;
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowingChild shouldThrow={shouldThrow} />
        </ErrorBoundary>,
      );

      expect(screen.getByText('boom-in-render')).toBeTruthy();

      shouldThrow = false;
      rerender(
        <ErrorBoundary>
          <ThrowingChild shouldThrow={shouldThrow} />
        </ErrorBoundary>,
      );
      fireEvent.click(screen.getByRole('button'));

      expect(screen.getByTestId('healthy').textContent).toBe('ok');
    } finally {
      spy.mockRestore();
    }
  });
});
