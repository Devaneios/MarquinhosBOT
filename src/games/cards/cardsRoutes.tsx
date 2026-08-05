import { Route } from 'react-router-dom';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { CardsGame } from './CardsGame';

export function cardsRoutes(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  return (
    <Route
      path="cards"
      element={<CardsGame identity={identity} onAuthInvalid={onAuthInvalid} />}
    />
  );
}
