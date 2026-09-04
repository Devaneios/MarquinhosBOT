import { Route } from 'react-router-dom';
import type { DiscordIdentity } from '../../discordAuth.ts';
import { WordChainGame } from './WordChainGame';

export function wordChainRoutes(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  return (
    <Route
      path="word-chain"
      element={
        <WordChainGame identity={identity} onAuthInvalid={onAuthInvalid} />
      }
    />
  );
}
