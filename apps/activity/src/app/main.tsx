import '@/i18n';
import '@/styles/global.css';
import { StrictMode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import App from './App';

const root = createRoot(document.getElementById('root')!);

flushSync(() => {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});

window.dispatchEvent(new Event('react-mounted'));
