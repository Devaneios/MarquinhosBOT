import { Route } from 'react-router-dom';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { BoggleGame } from './BoggleGame';

export function boggleRoutes(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  return (
    <Route
      path="boggle-word-race"
      element={
        <BoggleGame identity={identity} onAuthInvalid={onAuthInvalid} />
      }
    />
  );
}
