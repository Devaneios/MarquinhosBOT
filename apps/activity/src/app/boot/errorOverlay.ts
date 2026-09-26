// See index.html for why this is a separate <script type="module"> tag
// loaded before main.tsx, rather than an inline script or a regular import.
function showFatalError(reason: unknown) {
  const message =
    reason instanceof Error
      ? `${reason.name}: ${reason.message}\n${reason.stack ?? ''}`
      : String(reason);

  const pre = document.createElement('pre');
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
  document.body.appendChild(pre);
}

window.addEventListener('error', (event) => {
  showFatalError(event.error ?? event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  showFatalError(event.reason);
});
