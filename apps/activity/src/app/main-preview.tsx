import { HubScreen } from '@/features/hub/HubScreen';
import '@/i18n';
import '@/styles/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MemoryRouter>
      <div className="app-shell flex min-h-0 flex-1 flex-col">
        <HubScreen />
      </div>
    </MemoryRouter>
  </StrictMode>,
);
