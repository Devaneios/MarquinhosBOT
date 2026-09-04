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

async function freshDiscordAuthModule(sdk: ReturnType<typeof fakeSdk>) {
  const resetDiscordSdk = mock(() => {});
  mock.module('./discordSdk', () => ({
    discordSdk: sdk,
    isMock: false,
    resetDiscordSdk,
  }));
  mock.module('./lib/apiBase', () => ({
    apiUrl: (path: string) => `http://fake.test${path}`,
    // mock.module replaces this for the whole bun test process, not just
    // this file — keep this mock's shape matching every real export, or a
    // different test file that transitively loads the real module later in
    // the same run gets this stub instead and breaks on a missing export.
    colyseusUrl: () => 'ws://fake.test',
  }));
  // Importing this module has an immediate side effect: it starts the
  // handshake right away (see discordAuth.ts) — that's the behavior under
  // test, not something to work around.
  const mod = await import(`./discordAuth.ts?${Math.random()}`);
  return {
    runAuthFlow: mod.runAuthFlow as (force?: boolean) => Promise<unknown>,
    resetDiscordSdk,
    identityStore: mod.identityStore as {
      subscribe: (listener: () => void) => () => void;
      getSnapshot: () => { status: string; identity?: { userId: string } };
      reauth: () => void;
    },
  };
}

describe('runAuthFlow', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('dedupes two concurrent calls into a single authorize() RPC', async () => {
    stubTokenExchange();
    const sdk = fakeSdk();
    const { runAuthFlow } = await freshDiscordAuthModule(sdk);

    const [a, b] = await Promise.all([runAuthFlow(), runAuthFlow()]);

    expect(sdk.commands.authorize).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
  });

  it('clears the cache on failure so a later call retries', async () => {
    stubTokenExchange();
    const sdk = fakeSdk();
    sdk.commands.authorize = mock(async () => {
      throw new Error('Already authing');
    });
    const { runAuthFlow } = await freshDiscordAuthModule(sdk);

    // The module self-starts on import (see discordAuth.ts), so this may be
    // joining that attempt or a fresh one depending on timing — either way,
    // with authorize always throwing, it must surface the same failure.
    await expect(runAuthFlow()).rejects.toThrow('Already authing');

    sdk.commands.authorize = mock(async () => ({ code: 'auth-code' }));
    await expect(runAuthFlow()).resolves.toBeTruthy();
  });

  it('force:true re-invokes the handshake instead of resolving from a stale cache', async () => {
    stubTokenExchange();
    const sdk = fakeSdk({ userIds: ['user-1', 'user-2'] });
    const { runAuthFlow } = await freshDiscordAuthModule(sdk);

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
    const { runAuthFlow } = await freshDiscordAuthModule(sdk);

    await runAuthFlow();
    const [a, b] = await Promise.all([runAuthFlow(true), runAuthFlow(true)]);

    expect(sdk.commands.authorize).toHaveBeenCalledTimes(2);
    expect(a).toEqual(b);
  });

  it('resets the discord SDK singleton when the handshake fails, so a wedged connection is not reused', async () => {
    stubTokenExchange();
    const sdk = fakeSdk();
    const { runAuthFlow, resetDiscordSdk } = await freshDiscordAuthModule(sdk);

    // Let the self-started attempt succeed first, so the cache is settled —
    // only then does force:true guarantee a single fresh attempt to fail.
    await runAuthFlow();
    expect(resetDiscordSdk).not.toHaveBeenCalled();

    sdk.commands.authorize = mock(async () => {
      throw new Error('Authentication expired after 15 seconds');
    });
    await expect(runAuthFlow(true)).rejects.toThrow(
      'Authentication expired after 15 seconds',
    );

    expect(resetDiscordSdk).toHaveBeenCalledTimes(1);
  });

  it('does not reset the discord SDK singleton on a successful handshake', async () => {
    stubTokenExchange();
    const sdk = fakeSdk();
    const { runAuthFlow, resetDiscordSdk } = await freshDiscordAuthModule(sdk);

    await runAuthFlow();

    expect(resetDiscordSdk).not.toHaveBeenCalled();
  });
});

describe('identityStore', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('starts the handshake as soon as the module loads, with no subscriber needed', async () => {
    stubTokenExchange();
    const sdk = fakeSdk();
    // No identityStore.subscribe() call anywhere before this — importing the
    // module alone must be enough to have kicked off the handshake.
    const { runAuthFlow } = await freshDiscordAuthModule(sdk);

    await runAuthFlow();

    expect(sdk.commands.authorize).toHaveBeenCalledTimes(1);
  });

  it('publishes a ready snapshot once the handshake resolves, without needing a subscriber', async () => {
    stubTokenExchange();
    const sdk = fakeSdk();
    const { runAuthFlow, identityStore } = await freshDiscordAuthModule(sdk);

    await runAuthFlow();

    const snapshot = identityStore.getSnapshot();
    expect(snapshot.status).toBe('ready');
    expect(snapshot.identity?.userId).toBe('user-1');
  });

  it('subscribing does not itself trigger another handshake attempt', async () => {
    stubTokenExchange();
    const sdk = fakeSdk();
    const { runAuthFlow, identityStore } = await freshDiscordAuthModule(sdk);

    identityStore.subscribe(() => {});
    identityStore.subscribe(() => {});
    await runAuthFlow();

    expect(sdk.commands.authorize).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers when the snapshot changes', async () => {
    stubTokenExchange();
    const sdk = fakeSdk();
    const { runAuthFlow, identityStore } = await freshDiscordAuthModule(sdk);
    const listener = mock(() => {});

    identityStore.subscribe(listener);
    await runAuthFlow();

    expect(listener).toHaveBeenCalled();
  });

  it('reauth() re-runs the handshake and publishes the new identity', async () => {
    stubTokenExchange();
    const sdk = fakeSdk({ userIds: ['user-1', 'user-2'] });
    const { runAuthFlow, identityStore } = await freshDiscordAuthModule(sdk);

    await runAuthFlow();

    identityStore.reauth();
    await runAuthFlow();

    expect(sdk.commands.authorize).toHaveBeenCalledTimes(2);
    expect(identityStore.getSnapshot()).toEqual(
      expect.objectContaining({
        status: 'ready',
        identity: expect.objectContaining({ userId: 'user-2' }),
      }),
    );
  });

  it('keeps the ready snapshot and does not restart the handshake when a listener unsubscribes and a new one subscribes', async () => {
    stubTokenExchange();
    const sdk = fakeSdk();
    const { runAuthFlow, identityStore } = await freshDiscordAuthModule(sdk);

    await runAuthFlow();
    const unsubscribe = identityStore.subscribe(() => {});
    unsubscribe();

    identityStore.subscribe(() => {});

    expect(identityStore.getSnapshot().status).toBe('ready');
    expect(sdk.commands.authorize).toHaveBeenCalledTimes(1);
  });
});
