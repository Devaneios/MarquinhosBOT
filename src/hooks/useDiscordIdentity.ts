import { useCallback, useEffect, useRef, useState } from 'react';
import { discordSdk, isMock } from '../discordSdk';
import { tImperative } from '../i18n/i18nImperative';
import { apiUrl } from '../lib/apiBase';
import { devinfo, devlog } from '../lib/devlog';
import { errorMessage, postJson } from '../lib/http';

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
    scope: ['identify'],
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
  const authAttemptRef = useRef(0);

  const reauth = useCallback(() => {
    const attempt = ++authAttemptRef.current;
    devlog('[auth] reauth triggered');
    cache = null;
    setState({ status: 'loading' });
    runAuthFlow(true)
      .then((identity) => {
        if (attempt !== authAttemptRef.current) return;
        setState({ status: 'ready', identity, reauth });
      })
      .catch(
        (err) =>
          attempt === authAttemptRef.current &&
          setState({ status: 'error', error: errorMessage(err), reauth }),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    const attempt = ++authAttemptRef.current;

    runAuthFlow()
      .then((identity) => {
        if (cancelled || attempt !== authAttemptRef.current) return;
        devinfo('[auth] identity ready', identity.userId);
        setState({ status: 'ready', identity, reauth });
      })
      .catch((err) => {
        if (cancelled || attempt !== authAttemptRef.current) return;
        console.error('[auth] handshake failed', errorMessage(err));
        setState({ status: 'error', error: errorMessage(err), reauth });
      });

    return () => {
      cancelled = true;
    };
  }, [reauth]);

  return state;
}
