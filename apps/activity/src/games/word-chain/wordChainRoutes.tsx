import type { DiscordIdentity } from '@/discord/auth';
import { Route } from 'react-router-dom';
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
