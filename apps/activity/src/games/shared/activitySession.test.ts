import { afterEach, describe, expect, it } from 'bun:test';
import {
  createRoom,
  fetchDeepLinkIntent,
  fetchWsSessionToken,
  getAvailableRooms,
} from './activitySession';

describe('fetchWsSessionToken', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('posts the identity, game and mode, resolving to the token and roomKey', async () => {
    let capturedBody: unknown;
    globalThis.fetch = (async (_url: unknown, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string);
      return new Response(
        JSON.stringify({
          data: { token: 'tok-123', roomKey: 'inst-1:wordle:single:user-1' },
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const session = await fetchWsSessionToken({
      game: 'wordle',
      mode: 'single',
      identity: {
        userId: 'user-1',
        guildId: 'guild-1',
        instanceId: 'inst-1',
        accessToken: 'acc-1',
      },
    });

    expect(session).toEqual({
      token: 'tok-123',
      roomKey: 'inst-1:wordle:single:user-1',
    });
    expect(capturedBody).toEqual({
      accessToken: 'acc-1',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'single',
      game: 'wordle',
    });
  });

  it('spreads extra fields into the request body', async () => {
    let capturedBody: unknown;
    globalThis.fetch = (async (_url: unknown, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string);
      return new Response(
        JSON.stringify({
          data: { token: 'tok-abc', roomKey: 'inst-1:pong:single:user-1' },
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    await fetchWsSessionToken({
      game: 'pong',
      mode: 'single',
      identity: {
        userId: 'user-1',
        guildId: 'guild-1',
        instanceId: 'inst-1',
        accessToken: 'acc-1',
      },
      extra: { difficulty: 'hard', winningScore: 21 },
    });

    expect(capturedBody).toMatchObject({
      difficulty: 'hard',
      winningScore: 21,
      game: 'pong',
    });
  });

  it('propagates a non-ok response as a rejected promise', async () => {
    globalThis.fetch = (async () =>
      new Response('', { status: 401 })) as unknown as typeof fetch;

    await expect(
      fetchWsSessionToken({
        game: 'wordle',
        mode: 'single',
        identity: {
          userId: 'user-1',
          guildId: 'guild-1',
          instanceId: 'inst-1',
          accessToken: 'acc-1',
        },
      }),
    ).rejects.toMatchObject({ status: 401 });
  });
});

describe('createRoom', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('posts the identity, game and queueEnabled, resolving to roomId/token/roomKey', async () => {
    let capturedBody: unknown;
    globalThis.fetch = (async (_url: unknown, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string);
      return new Response(
        JSON.stringify({
          data: {
            roomId: 'ABC123',
            token: 'tok-456',
            roomKey: 'inst-1:ABC123:tic-tac-toe:multi',
          },
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const room = await createRoom({
      game: 'tic-tac-toe',
      identity: {
        userId: 'user-1',
        guildId: 'guild-1',
        instanceId: 'inst-1',
        accessToken: 'acc-1',
      },
      queueEnabled: true,
    });

    expect(room).toEqual({
      roomId: 'ABC123',
      token: 'tok-456',
      roomKey: 'inst-1:ABC123:tic-tac-toe:multi',
    });
    expect(capturedBody).toEqual({
      accessToken: 'acc-1',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      game: 'tic-tac-toe',
      queueEnabled: true,
    });
  });

  it('propagates a non-ok response as a rejected promise', async () => {
    globalThis.fetch = (async () =>
      new Response('', { status: 401 })) as unknown as typeof fetch;

    await expect(
      createRoom({
        game: 'tic-tac-toe',
        identity: {
          userId: 'user-1',
          guildId: 'guild-1',
          instanceId: 'inst-1',
          accessToken: 'acc-1',
        },
        queueEnabled: false,
      }),
    ).rejects.toMatchObject({ status: 401 });
  });
});

describe('fetchDeepLinkIntent', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('posts the access token and guildId, resolving to the claimed game', async () => {
    let capturedBody: unknown;
    globalThis.fetch = (async (_url: unknown, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string);
      return new Response(JSON.stringify({ data: { game: 'wordle' } }), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const intent = await fetchDeepLinkIntent({
      userId: 'user-1',
      guildId: 'guild-1',
      instanceId: 'inst-1',
      accessToken: 'acc-1',
    });

    expect(intent).toEqual({ game: 'wordle' });
    expect(capturedBody).toEqual({
      accessToken: 'acc-1',
      guildId: 'guild-1',
    });
  });

  it('resolves to a null game when there is no pending intent', async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ data: { game: null } }), {
        status: 200,
      })) as unknown as typeof fetch;

    const intent = await fetchDeepLinkIntent({
      userId: 'user-1',
      guildId: 'guild-1',
      instanceId: 'inst-1',
      accessToken: 'acc-1',
    });

    expect(intent).toEqual({ game: null });
  });

  it('propagates a non-ok response as a rejected promise', async () => {
    globalThis.fetch = (async () =>
      new Response('', { status: 401 })) as unknown as typeof fetch;

    await expect(
      fetchDeepLinkIntent({
        userId: 'user-1',
        guildId: 'guild-1',
        instanceId: 'inst-1',
        accessToken: 'acc-1',
      }),
    ).rejects.toMatchObject({ status: 401 });
  });
});

describe('getAvailableRooms', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('posts the identity, resolving to the room listing', async () => {
    let capturedBody: unknown;
    globalThis.fetch = (async (_url: unknown, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string);
      return new Response(
        JSON.stringify({
          data: [
            {
              instanceId: 'inst-1',
              roomId: 'ROOM01',
              game: 'tic-tac-toe',
              hostUserId: 'u2',
              playerCount: 1,
              spectatorCount: 0,
              queueDepth: 0,
              queueEnabled: false,
              mode: 'multi',
            },
          ],
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const rooms = await getAvailableRooms({
      userId: 'user-1',
      guildId: 'guild-1',
      instanceId: 'inst-1',
      accessToken: 'acc-1',
    });

    expect(rooms).toEqual([
      {
        instanceId: 'inst-1',
        roomId: 'ROOM01',
        game: 'tic-tac-toe',
        hostUserId: 'u2',
        playerCount: 1,
        spectatorCount: 0,
        queueDepth: 0,
        queueEnabled: false,
        mode: 'multi',
      },
    ]);
    expect(capturedBody).toEqual({
      accessToken: 'acc-1',
      instanceId: 'inst-1',
      guildId: 'guild-1',
    });
  });

  it('propagates a non-ok response as a rejected promise', async () => {
    globalThis.fetch = (async () =>
      new Response('', { status: 401 })) as unknown as typeof fetch;

    await expect(
      getAvailableRooms({
        userId: 'user-1',
        guildId: 'guild-1',
        instanceId: 'inst-1',
        accessToken: 'acc-1',
      }),
    ).rejects.toMatchObject({ status: 401 });
  });
});
