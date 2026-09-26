import { useSyncExternalStore } from 'react';
import { identityStore } from './auth';

export type { DiscordIdentity, DiscordIdentityState } from './auth';

export function useDiscordIdentity() {
  return useSyncExternalStore(
    identityStore.subscribe,
    identityStore.getSnapshot,
  );
}
