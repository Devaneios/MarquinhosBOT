// See index.html for why this is a separate <script type="module"> tag
// loaded before main.tsx, rather than an inline script or a regular import.
function showFatalError(reason: unknown, doc: Document) {
  const message =
    reason instanceof Error
      ? `${reason.name}: ${reason.message}\n${reason.stack ?? ''}`
      : String(reason);

  const pre = doc.createElement('pre');
  pre.dataset.bootErrorOverlay = 'true';
  pre.style.cssText = [
    'position:fixed',
    'inset:0',
    'margin:0',
    'padding:16px',
    'background:#1a0000',
    'color:#ff8080',
    'font:12px/1.5 monospace',
    'white-space:pre-wrap',
    'overflow:auto',
    'z-index:2147483647',
  ].join(';');
  pre.textContent = message;
  doc.body.appendChild(pre);
}

let activeCleanup: (() => void) | null = null;

/**
 * Shows a pre-mount fatal error overlay only while booting; once `react-mounted`
 * fires, removes DOM hijacking handlers so runtime rejections log instead of
 * blanking the active game screen.
 */
export function installBootErrorOverlay(
  target: Window = window,
  doc: Document = document,
): () => void {
  activeCleanup?.();

  const onError = (event: ErrorEvent) => {
    showFatalError(event.error ?? event.message, doc);
  };

  const onRejection = (event: PromiseRejectionEvent) => {
    showFatalError(event.reason, doc);
  };

  const detachBootHandlers = () => {
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onRejection);
  };

  const onMounted = () => {
    detachBootHandlers();
  };

  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);
  target.addEventListener('react-mounted', onMounted, { once: true });

  const cleanup = () => {
    detachBootHandlers();
    target.removeEventListener('react-mounted', onMounted);
    if (activeCleanup === cleanup) {
      activeCleanup = null;
    }
  };
  activeCleanup = cleanup;
  return cleanup;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  installBootErrorOverlay(window, document);
}
