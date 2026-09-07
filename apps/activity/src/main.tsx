import { StrictMode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './i18n';
import './index.css';

const root = createRoot(document.getElementById('root')!);

flushSync(() => {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});

window.dispatchEvent(new Event('react-mounted'));
