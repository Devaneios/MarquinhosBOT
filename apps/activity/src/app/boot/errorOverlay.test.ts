import { afterEach, describe, expect, it } from 'bun:test';
import { installBootErrorOverlay } from './errorOverlay';

describe('errorOverlay', () => {
  let cleanupOverlay: (() => void) | null = null;

  afterEach(() => {
    cleanupOverlay?.();
    cleanupOverlay = null;
    document.body.innerHTML = '';
  });

  it('renders overlay pre-mount and stops hijacking viewport after react-mounted', () => {
    cleanupOverlay = installBootErrorOverlay(window, document);

    window.dispatchEvent(
      new ErrorEvent('error', { error: new Error('boot crash') }),
    );
    const pre = document.querySelector('pre[data-boot-error-overlay="true"]');
    expect(pre?.textContent).toContain('boot crash');
    pre?.remove();

    window.dispatchEvent(new Event('react-mounted'));
    window.dispatchEvent(
      new ErrorEvent('error', { error: new Error('later error') }),
    );

    expect(
      document.querySelector('pre[data-boot-error-overlay="true"]'),
    ).toBeNull();
  });
});
