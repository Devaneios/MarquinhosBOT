import { afterEach, describe, expect, it } from 'bun:test';

// Preserved and restored per test, not deleted — bun's test environment now
// has a real, process-wide happy-dom `window` (see bunfig.toml's preload),
// which every other test file's component rendering depends on staying
// intact for the rest of the run. Deleting `globalThis.window` here would
// silently break any test file that happens to run afterward.
const originalWindow = globalThis.window;

function setLocation(hostname: string, protocol = 'https:') {
  (globalThis as unknown as { window: unknown }).window = {
    location: { hostname, protocol, host: hostname },
  };
}

describe('colyseusUrl', () => {
  afterEach(() => {
    (globalThis as { window?: unknown }).window = originalWindow;
  });

  it('returns the Discord proxy endpoint when inside the proxy', async () => {
    setLocation('abc123.discordsays.com');
    const { colyseusUrl } = await import(`./apiBase?discord-${Date.now()}`);

    expect(colyseusUrl()).toBe('wss://abc123.discordsays.com/.proxy/colyseus');
  });

  it('returns the local API origin (ws-swapped) outside the proxy', async () => {
    setLocation('localhost');
    const { colyseusUrl, apiUrl } = await import(
      `./apiBase?local-${Date.now()}`
    );

    // apiUrl() already proves what apiOrigin() resolves to in this env
    // (`${origin}/api${path}`) — derive the expected ws-swapped origin from
    // it instead of hardcoding a default that a local .env can override.
    const origin = apiUrl('').replace(/\/api\/?$/, '');
    expect(colyseusUrl()).toBe(origin.replace(/^http/, 'ws'));
  });
});
