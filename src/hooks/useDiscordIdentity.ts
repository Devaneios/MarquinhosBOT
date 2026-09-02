import { useSyncExternalStore } from 'react';
import { identityStore } from '../discordAuth';

export type { DiscordIdentity, DiscordIdentityState } from '../discordAuth';

export function useDiscordIdentity() {
  return useSyncExternalStore(
    identityStore.subscribe,
    identityStore.getSnapshot,
  );
}
