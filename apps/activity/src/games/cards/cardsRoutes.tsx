import type { DiscordIdentity } from '@/platform/discord/auth';
import { Route } from 'react-router-dom';
import { CardTableRoute } from './components/CardTableRoute';
import { CardModeSelect } from './components/index';

export function cardsRoutes(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  return (
    <>
      <Route path="cards" element={<CardModeSelect />} />
      <Route
        path="cards/:ruleset"
        element={
          <CardTableRoute identity={identity} onAuthInvalid={onAuthInvalid} />
        }
      />
    </>
  );
}
