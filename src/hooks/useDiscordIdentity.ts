import { useCallback, useEffect, useState } from 'react';
import { getDiscordSdk } from '../discordSdk';
import { apiUrl } from '../lib/apiBase';
import { errorMessage, postJson } from '../lib/http';

export interface DiscordIdentity {
  userId: string;
  guildId: string;
  instanceId: string;
  accessToken: string;
}

export type DiscordIdentityState =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; identity: DiscordIdentity; reauth: () => void };

async function doHandshake(): Promise<DiscordIdentity> {
  const discordSdk = getDiscordSdk();
  await discordSdk.ready();

  const { code } = await discordSdk.commands.authorize({
    client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
    response_type: 'code',
    state: '',
    prompt: 'none',
    scope: ['identify'],
  });

  const { access_token } = await postJson<{ access_token: string }>(
    apiUrl('/activities/token'),
    { code },
  );

  const auth = await discordSdk.commands.authenticate({ access_token });

  if (!discordSdk.guildId) {
    throw new Error('This Activity must be launched inside a server');
  }

  return {
    userId: auth.user.id,
    guildId: discordSdk.guildId,
    instanceId: discordSdk.instanceId,
    accessToken: access_token,
  };
}

// Discord's client only tolerates one `authorize` RPC in flight at a time —
// a second call while the first hasn't finished authenticating yet fails
// with "Already authing". React StrictMode mounts this hook's effect twice,
// and reauth() can in principle be triggered twice in the same tick, so
// every caller in the same window has to await the same in-flight attempt
// instead of starting its own. `force` evicts a *settled* (resolved) cache
// entry so reauth() doesn't just resolve from stale data — but never evicts
// an entry that's still in flight, so concurrent forced calls collapse onto
// one attempt instead of racing two `authorize()` RPCs.
let cache: { promise: Promise<DiscordIdentity>; settled: boolean } | null = null;

export function runAuthFlow(force = false): Promise<DiscordIdentity> {
  if (force && cache?.settled) cache = null;
  if (cache) return cache.promise;

  const entry: { promise: Promise<DiscordIdentity>; settled: boolean } = {
    promise: null as unknown as Promise<DiscordIdentity>,
    settled: false,
  };
  entry.promise = doHandshake()
    .then((identity) => {
      entry.settled = true;
      return identity;
    })
    .catch((err) => {
      if (cache === entry) cache = null;
      throw err;
    });
  cache = entry;
  return entry.promise;
}

export function useDiscordIdentity(): DiscordIdentityState {
  const [state, setState] = useState<DiscordIdentityState>({
    status: 'loading',
  });

  const reauth = useCallback(() => {
    setState({ status: 'loading' });
    runAuthFlow(true)
      .then((identity) => setState({ status: 'ready', identity, reauth }))
      .catch((err) => setState({ status: 'error', error: errorMessage(err) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;

    runAuthFlow()
      .then((identity) => {
        if (!cancelled) setState({ status: 'ready', identity, reauth });
      })
      .catch((err) => {
        if (!cancelled) setState({ status: 'error', error: errorMessage(err) });
      });

    return () => {
      cancelled = true;
    };
  }, [reauth]);

  return state;
}
