import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'bun:test';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { DiscordIdentity } from '../discordAuth.ts';
import { useDeepLinkIntent } from './useDeepLinkIntent';

const identity: DiscordIdentity = {
  userId: 'user-1',
  guildId: 'guild-1',
  instanceId: 'inst-1',
  accessToken: 'acc-1',
};

function Probe() {
  useDeepLinkIntent(identity);
  const location = useLocation();
  return <div data-testid="path">{location.pathname}</div>;
}

function renderProbe() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Probe />
    </MemoryRouter>,
  );
}

function mockClaimResponse(body: { game: string | null }) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ data: body }), {
      status: 200,
    })) as unknown as typeof fetch;
}

describe('useDeepLinkIntent', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('navigates to the claimed game route', async () => {
    mockClaimResponse({ game: 'wordle' });

    renderProbe();

    await waitFor(() =>
      expect(screen.getByTestId('path').textContent).toBe('/games/wordle'),
    );
  });

  it('stays on the current route when there is no pending intent', async () => {
    mockClaimResponse({ game: null });

    renderProbe();

    // Give the effect's promise a tick to resolve before asserting the
    // negative — there's no visible state change to waitFor here.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.getByTestId('path').textContent).toBe('/');
  });

  it('stays on the current route when the fetch rejects', async () => {
    globalThis.fetch = (async () =>
      new Response('', { status: 401 })) as unknown as typeof fetch;

    renderProbe();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.getByTestId('path').textContent).toBe('/');
  });

  it('ignores a game id that is not in the game registry', async () => {
    mockClaimResponse({ game: 'not-a-real-game' });

    renderProbe();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.getByTestId('path').textContent).toBe('/');
  });
});
