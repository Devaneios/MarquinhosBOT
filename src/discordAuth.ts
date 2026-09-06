// Loaded as its own <script type="module"> tag in index.html, before
// main.tsx (see index.html for why) — so the Discord handshake starts, and
// keeps running, independently of whether React's module graph ever finishes
// evaluating or main.tsx ever manages to mount. React (useDiscordIdentity)
// only ever reads a snapshot of this; it never triggers or drives it.
import { discordSdk, isMock, resetDiscordSdk } from './discordSdk';
import { tImperative } from './i18n/i18nImperative';
import { apiUrl } from './lib/apiBase';
import { devinfo, devlog } from './lib/devlog';
import { errorMessage, postJson } from './lib/http';

export interface DiscordIdentity {
  userId: string;
  guildId: string;
  instanceId: string;
  accessToken: string;
}

export type DiscordIdentityState =
  | { status: 'loading' }
  | { status: 'error'; error: string; reauth: () => void }
  | { status: 'ready'; identity: DiscordIdentity; reauth: () => void };

const AUTH_TIMEOUT_MS = 15_000;

async function doHandshake(): Promise<DiscordIdentity> {
  devlog('[auth] starting handshake');

  await discordSdk.ready();
  devlog('[auth] sdk ready');

  const { code } = await discordSdk.commands.authorize({
    client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
    response_type: 'code',
    state: '',
    prompt: 'none',
    scope: ['identify', 'guilds.members.read'],
  });
  devlog('[auth] got authorization code');

  const access_token = isMock
    ? 'mock-access-token'
    : (
        await postJson<{ access_token: string }>(apiUrl('/activities/token'), {
          code,
        })
      )?.access_token;
  devlog('[auth] exchanged code for access token');

  const auth = await discordSdk.commands.authenticate({ access_token });
  devlog('[auth] authenticated as', auth.user.id);

  if (!discordSdk.guildId) {
    console.error('[auth] missing guildId — not launched inside a server');
    throw new Error(tImperative('mustLaunchInServer', 'common'));
  }

  devinfo('[auth] handshake complete', {
    userId: auth.user.id,
    guildId: discordSdk.guildId,
    instanceId: discordSdk.instanceId,
  });

  return {
    userId: auth.user.id,
    guildId: discordSdk.guildId,
    instanceId: discordSdk.instanceId,
    accessToken: access_token,
  };
}

let cache: { promise: Promise<DiscordIdentity>; settled: boolean } | null =
  null;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(
      () =>
        reject(
          new Error(
            tImperative('authTimeout', 'common', {
              seconds: AUTH_TIMEOUT_MS / 1000,
            }),
          ),
        ),
      AUTH_TIMEOUT_MS,
    );

    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

export function runAuthFlow(force = false): Promise<DiscordIdentity> {
  if (force && cache?.settled) cache = null;
  if (cache) {
    devlog('[auth] reusing in-flight/cached auth attempt');
    return cache.promise;
  }

  const entry: { promise: Promise<DiscordIdentity>; settled: boolean } = {
    promise: null as unknown as Promise<DiscordIdentity>,
    settled: false,
  };
  entry.promise = withTimeout(doHandshake())
    .then((identity) => {
      entry.settled = true;
      return identity;
    })
    .catch((err) => {
      // Only reset the SDK singleton for the entry that is still current —
      // a stale/superseded entry's own failure must not tear down a fresher
      // attempt's connection out from under it.
      if (cache === entry) {
        cache = null;
        resetDiscordSdk();
      }
      throw err;
    });
  cache = entry;
  return entry.promise;
}

let generation = 0;
let snapshot: DiscordIdentityState = { status: 'loading' };
const listeners = new Set<() => void>();

function setSnapshot(next: DiscordIdentityState): void {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function runAttempt(force: boolean): void {
  const attempt = ++generation;
  setSnapshot({ status: 'loading' });
  runAuthFlow(force)
    .then((identity) => {
      if (attempt !== generation) return;
      devinfo('[auth] identity ready', identity.userId);
      setSnapshot({ status: 'ready', identity, reauth });
    })
    .catch((err) => {
      if (attempt !== generation) return;
      console.error('[auth] handshake failed', errorMessage(err));
      setSnapshot({ status: 'error', error: errorMessage(err), reauth });
    });
}

function reauth(): void {
  devlog('[auth] reauth triggered');
  runAttempt(true);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): DiscordIdentityState {
  return snapshot;
}

export const identityStore = { subscribe, getSnapshot, reauth };

// Start immediately, at module-evaluation time — not lazily on first React
// subscribe. This is the whole point: the handshake must not depend on React
// ever mounting successfully.
runAttempt(false);
