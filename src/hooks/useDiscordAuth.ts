import { useEffect, useState } from 'react';
import { getDiscordSdk } from '../discordSdk';
import { apiUrl } from '../lib/apiBase';

type DiscordAuthState =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | {
      status: 'ready';
      userId: string;
      guildId: string;
      instanceId: string;
      wsToken: string;
    };

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

export function useDiscordAuth(): DiscordAuthState {
  const [state, setState] = useState<DiscordAuthState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
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

        const { token } = await postJson<{ token: string }>(
          apiUrl('/activities/ws-session'),
          {
            accessToken: access_token,
            instanceId: discordSdk.instanceId,
            guildId: discordSdk.guildId,
          },
        );

        if (cancelled) return;
        setState({
          status: 'ready',
          userId: auth.user.id,
          guildId: discordSdk.guildId,
          instanceId: discordSdk.instanceId,
          wsToken: token,
        });
      } catch (err) {
        if (cancelled) return;
        setState({
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
