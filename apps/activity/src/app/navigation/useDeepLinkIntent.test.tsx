import type { DiscordIdentity } from '@/platform/discord/auth';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from 'bun:test';
import { useDeepLinkIntent } from './useDeepLinkIntent';

const identity: DiscordIdentity = {
  userId: 'user-1',
  guildId: 'guild-1',
  instanceId: 'inst-1',
  accessToken: 'acc-1',
};

function Probe({ identity }: { identity: DiscordIdentity | null }) {
  const path = useDeepLinkIntent(identity);
  return <div data-testid="path">{String(path)}</div>;
}

function renderedPath() {
  return screen.getByTestId('path').textContent;
}

function mockClaimResponse(body: { game: string | null }) {
  const calls: unknown[] = [];
  globalThis.fetch = (async (...args: unknown[]) => {
    calls.push(args);
    return new Response(JSON.stringify({ data: body }), { status: 200 });
  }) as unknown as typeof fetch;
  return calls;
}

function mockPendingClaim() {
  let respond: (body: { game: string | null }) => void = () => {};
  globalThis.fetch = (() =>
    new Promise<Response>((resolve) => {
      respond = (body) =>
        resolve(new Response(JSON.stringify({ data: body }), { status: 200 }));
    })) as unknown as typeof fetch;
  return { respond: (body: { game: string | null }) => respond(body) };
}

describe('useDeepLinkIntent', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('stays unresolved and skips the claim while there is no identity', async () => {
    const calls = mockClaimResponse({ game: 'wordle' });

    render(<Probe identity={null} />);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(renderedPath()).toBe('null');
    expect(calls).toHaveLength(0);
  });

  it('stays unresolved while the claim is in flight', () => {
    mockPendingClaim();

    render(<Probe identity={identity} />);

    expect(renderedPath()).toBe('null');
  });

  it('resolves to the claimed game route', async () => {
    mockClaimResponse({ game: 'wordle' });

    render(<Probe identity={identity} />);

    await waitFor(() => expect(renderedPath()).toBe('/games/wordle'));
  });

  it('resolves to the hub when there is no pending intent', async () => {
    mockClaimResponse({ game: null });

    render(<Probe identity={identity} />);

    await waitFor(() => expect(renderedPath()).toBe('/'));
  });

  it('resolves to the hub when the fetch rejects', async () => {
    globalThis.fetch = (async () =>
      new Response('', { status: 401 })) as unknown as typeof fetch;

    render(<Probe identity={identity} />);

    await waitFor(() => expect(renderedPath()).toBe('/'));
  });

  it('resolves to the hub for a game id that is not in the game registry', async () => {
    mockClaimResponse({ game: 'not-a-real-game' });

    render(<Probe identity={identity} />);

    await waitFor(() => expect(renderedPath()).toBe('/'));
  });

  it('resolves to the hub when the claim times out, ignoring a late answer', async () => {
    jest.useFakeTimers();
    const claim = mockPendingClaim();

    render(<Probe identity={identity} />);
    act(() => {
      jest.advanceTimersByTime(3_000);
    });
    expect(renderedPath()).toBe('/');

    await act(async () => {
      claim.respond({ game: 'wordle' });
      await Promise.resolve();
    });
    expect(renderedPath()).toBe('/');
  });

  it('claims once per identity object, and again after a reauth', async () => {
    const calls = mockClaimResponse({ game: 'wordle' });

    const { rerender } = render(<Probe identity={identity} />);
    await waitFor(() => expect(renderedPath()).toBe('/games/wordle'));

    rerender(<Probe identity={identity} />);
    expect(calls).toHaveLength(1);

    mockClaimResponse({ game: null });
    rerender(<Probe identity={{ ...identity }} />);
    expect(renderedPath()).toBe('null');

    await waitFor(() => expect(renderedPath()).toBe('/'));
  });
});
