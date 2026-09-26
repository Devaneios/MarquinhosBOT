import type { DiscordIdentity } from '@/discord/auth';
import { Route } from 'react-router-dom';
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
