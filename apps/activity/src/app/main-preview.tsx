import '@/i18n';
import type { DiscordIdentity } from '@/platform/discord/auth';
import '@/styles/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from './router';

const previewIdentity: DiscordIdentity = {
  userId: 'preview-user',
  guildId: 'preview-guild',
  instanceId: 'preview-instance',
  accessToken: 'preview-token',
};

const initialEntry = window.location.hash.startsWith('#/')
  ? window.location.hash.slice(1)
  : '/';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MemoryRouter initialEntries={[initialEntry]}>
      <div className="app-shell relative flex h-full w-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top,rgba(255,176,0,0.12),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_20%),var(--color-marquinhos-bg)] text-marquinhos-text">
        <AppRoutes identity={previewIdentity} onAuthInvalid={() => {}} />
      </div>
    </MemoryRouter>
  </StrictMode>,
);
