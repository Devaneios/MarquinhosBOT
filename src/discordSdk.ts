import { DiscordSDK, DiscordSDKMock } from '@discord/embedded-app-sdk';

export const isMock = window.self === window.top && import.meta.env.DEV;
const MOCK_GUILD_ID = '123456789012345678';
const MOCK_CHANNEL_ID = '987654321098765432';
let instance: DiscordSDK | DiscordSDKMock | null = null;

// Constructed lazily (instead of at module load) so failures — missing env
// var, missing frame_id because we're not actually embedded in Discord —
// surface through useDiscordIdentity's try/catch as a visible error instead of
// crashing script evaluation before React ever renders anything.
export function getDiscordSdk(): DiscordSDK | DiscordSDKMock {
  if (instance) return instance;

  const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID;
  if (!clientId) {
    throw new Error('VITE_DISCORD_CLIENT_ID is not set');
  }

  instance = isMock
    ? new DiscordSDKMock(clientId, MOCK_GUILD_ID, MOCK_CHANNEL_ID, null)
    : new DiscordSDK(clientId);
  return instance;
}

export const discordSdk: DiscordSDK | DiscordSDKMock = new Proxy(
  {} as DiscordSDK,
  {
    get(_target, prop, receiver) {
      return Reflect.get(getDiscordSdk() as object, prop, receiver);
    },
  },
);
