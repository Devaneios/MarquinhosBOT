import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { Hub } from './hub/Hub';
import './i18n';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MemoryRouter>
      <div className="app-shell flex min-h-0 flex-1 flex-col">
        <Hub />
      </div>
    </MemoryRouter>
  </StrictMode>,
);
