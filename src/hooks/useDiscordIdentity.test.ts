import { afterEach, describe, expect, it, mock } from 'bun:test';

const originalFetch = globalThis.fetch;

function stubTokenExchange(accessToken = 'tok-abc') {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ data: { access_token: accessToken } }), {
      status: 200,
    })) as unknown as typeof fetch;
}

function fakeSdk(overrides: { userIds?: string[] } = {}) {
  const userIds = overrides.userIds ?? ['user-1'];
  let authenticateCalls = 0;
  return {
    ready: mock(async () => {}),
    guildId: 'guild-1',
    instanceId: 'instance-1',
    commands: {
      authorize: mock(async () => ({ code: 'auth-code' })),
      authenticate: mock(async () => {
        const id = userIds[Math.min(authenticateCalls, userIds.length - 1)];
        authenticateCalls += 1;
        return { user: { id } };
      }),
    },
  };
}

async function freshRunAuthFlow(sdk: ReturnType<typeof fakeSdk>) {
  mock.module('../discordSdk', () => ({ getDiscordSdk: () => sdk }));
  mock.module('../lib/apiBase', () => ({
    apiUrl: (path: string) => `http://fake.test${path}`,
  }));
  const mod = await import(`./useDiscordIdentity.ts?${Math.random()}`);
  return mod.runAuthFlow as (force?: boolean) => Promise<unknown>;
}

describe('runAuthFlow', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('dedupes two concurrent calls into a single authorize() RPC', async () => {
    stubTokenExchange();
    const sdk = fakeSdk();
    const runAuthFlow = await freshRunAuthFlow(sdk);

    const [a, b] = await Promise.all([runAuthFlow(), runAuthFlow()]);

    expect(sdk.commands.authorize).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
  });

  it('clears the cache on failure so a later call retries', async () => {
    stubTokenExchange();
    const sdk = fakeSdk();
    let authorizeCalls = 0;
    sdk.commands.authorize = mock(async () => {
      authorizeCalls += 1;
      if (authorizeCalls === 1) throw new Error('Already authing');
      return { code: 'auth-code' };
    });
    const runAuthFlow = await freshRunAuthFlow(sdk);

    await expect(runAuthFlow()).rejects.toThrow('Already authing');
    await expect(runAuthFlow()).resolves.toBeTruthy();

    expect(sdk.commands.authorize).toHaveBeenCalledTimes(2);
  });

  it('force:true re-invokes the handshake instead of resolving from a stale cache', async () => {
    stubTokenExchange();
    const sdk = fakeSdk({ userIds: ['user-1', 'user-2'] });
    const runAuthFlow = await freshRunAuthFlow(sdk);

    const first = (await runAuthFlow()) as { userId: string };
    const second = (await runAuthFlow(true)) as { userId: string };

    expect(sdk.commands.authorize).toHaveBeenCalledTimes(2);
    expect(sdk.commands.authenticate).toHaveBeenCalledTimes(2);
    expect(first.userId).toBe('user-1');
    expect(second.userId).toBe('user-2');
  });

  it('concurrent force:true calls collapse onto a single authorize() RPC', async () => {
    stubTokenExchange();
    const sdk = fakeSdk({ userIds: ['user-1', 'user-2'] });
    const runAuthFlow = await freshRunAuthFlow(sdk);

    await runAuthFlow();
    const [a, b] = await Promise.all([runAuthFlow(true), runAuthFlow(true)]);

    expect(sdk.commands.authorize).toHaveBeenCalledTimes(2);
    expect(a).toEqual(b);
  });
});
