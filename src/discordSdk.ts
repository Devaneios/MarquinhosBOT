import { DiscordSDK } from '@discord/embedded-app-sdk';

let instance: DiscordSDK | null = null;

// Constructed lazily (instead of at module load) so failures — missing env
// var, missing frame_id because we're not actually embedded in Discord —
// surface through useDiscordIdentity's try/catch as a visible error instead of
// crashing script evaluation before React ever renders anything.
export function getDiscordSdk(): DiscordSDK {
  if (instance) return instance;

  const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID;
  if (!clientId) {
    throw new Error('VITE_DISCORD_CLIENT_ID is not set');
  }

  instance = new DiscordSDK(clientId);
  return instance;
}
