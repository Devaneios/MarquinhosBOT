import { useEffect, useState } from 'react';
import { getDiscordSdk } from '../discordSdk';
import { apiUrl } from '../lib/apiBase';

export type GameMode = 'single' | 'multi';

type DiscordAuthState =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'selecting-mode'; selectMode: (mode: GameMode) => void }
  | { status: 'connecting' }
  | { status: 'ready'; wsToken: string };

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Request to ${url} failed with ${res.status}`);
  }
  const { data } = await res.json();
  return data;
}

// Discord's embedded-app-sdk rejects RPC command failures (e.g. authorize,
// authenticate) with a raw `{ code, message }` payload instead of an Error
// instance, so `err instanceof Error` misses them and swallows the real
// message.
function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    typeof err.message === 'string'
  ) {
    return err.message;
  }
  return 'Unknown error';
}

interface DiscordIdentity {
  userId: string;
  guildId: string;
  instanceId: string;
  accessToken: string;
}

// Discord's client only tolerates one `authorize` RPC in flight at a time —
// a second call while the first hasn't finished authenticating yet fails
// with "Already authing". StrictMode mounts this hook's effect twice, and
// getDiscordSdk() hands both invocations the same SDK singleton, so without
// this cache each mount would kick off its own authorize() call and race.
// Caching the flow's promise makes the second mount await the first attempt
// instead of starting a new one.
let authPromise: Promise<DiscordIdentity> | null = null;

function runAuthFlow(): Promise<DiscordIdentity> {
  if (authPromise) return authPromise;

  const promise: Promise<DiscordIdentity> = (async () => {
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
  })().catch((err) => {
    // Let a later mount try again instead of replaying a stale failure.
    authPromise = null;
    throw err;
  });

  authPromise = promise;
  return promise;
}

export function useDiscordAuth(): DiscordAuthState {
  const [state, setState] = useState<DiscordAuthState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    runAuthFlow()
      .then((identity) => {
        if (cancelled) return;
        setState({
          status: 'selecting-mode',
          selectMode: (mode) => {
            setState({ status: 'connecting' });
            postJson<{ token: string }>(apiUrl('/activities/ws-session'), {
              accessToken: identity.accessToken,
              instanceId: identity.instanceId,
              guildId: identity.guildId,
              mode,
            })
              .then(({ token }) => {
                if (!cancelled) setState({ status: 'ready', wsToken: token });
              })
              .catch((err) => {
                if (!cancelled) {
                  setState({ status: 'error', error: errorMessage(err) });
                }
              });
          },
        });
      })
      .catch((err) => {
        if (!cancelled) setState({ status: 'error', error: errorMessage(err) });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
