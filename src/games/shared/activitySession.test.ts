import { afterEach, describe, expect, it } from 'bun:test';
import { fetchWsSessionToken } from './activitySession';

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
