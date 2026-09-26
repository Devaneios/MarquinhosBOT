// See index.html for why this is a separate <script type="module"> tag
// loaded before main.tsx, rather than an inline script (Discord's CSP
// silently drops inline <script> blocks without 'unsafe-inline').
window.addEventListener(
  'react-mounted',
  () => {
    document.getElementById('react-mount-overlay')?.remove();
  },
  { once: true },
);
