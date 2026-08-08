import { Route } from 'react-router-dom';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { DominoesBlockGame } from './DominoesBlockGame';

export function dominoesBlockRoutes(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  return (
    <Route
      path="dominoes-block"
      element={
        <DominoesBlockGame identity={identity} onAuthInvalid={onAuthInvalid} />
      }
    />
  );
}
