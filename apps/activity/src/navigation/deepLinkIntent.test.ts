import { afterEach, describe, expect, it } from 'bun:test';

import { fetchDeepLinkIntent } from './deepLinkIntent';

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
