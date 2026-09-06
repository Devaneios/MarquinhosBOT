import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { Hub } from './hub/Hub';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MemoryRouter>
      <div className="h-screen w-screen">
        <Hub />
      </div>
    </MemoryRouter>
  </StrictMode>,
);
