import { Client } from '@colyseus/sdk';
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { createServer, type ViteDevServer } from 'vite';
import { startGatewayTestServer } from '../api/tests/helpers/gatewayTestServer';

let api: Awaited<ReturnType<typeof startGatewayTestServer>>;
let vite: ViteDevServer;
let origin: string;
const previousTarget = process.env.DEV_API_TARGET;
const previousOrigin = process.env.DEV_PUBLIC_ORIGIN;

beforeAll(async () => {
  api = await startGatewayTestServer();
  process.env.DEV_API_TARGET = api.origin;
  process.env.DEV_PUBLIC_ORIGIN = 'https://dev.example.com';
  const root = import.meta.dirname;
  vite = await createServer({
    root,
    configFile: resolve(root, 'vite.config.ts'),
    logLevel: 'silent',
    server: { port: 0, host: '127.0.0.1' },
  });
  await vite.listen();
  const address = vite.httpServer?.address();
  if (!address || typeof address === 'string')
    throw new Error('No Vite test port');
  origin = `http://127.0.0.1:${address.port}`;
}, 30_000);

afterAll(async () => {
  await vite?.waitForRequestsIdle();
  await vite?.close();
  await api?.close();
  if (previousTarget === undefined) delete process.env.DEV_API_TARGET;
  else process.env.DEV_API_TARGET = previousTarget;
  if (previousOrigin === undefined) delete process.env.DEV_PUBLIC_ORIGIN;
  else process.env.DEV_PUBLIC_ORIGIN = previousOrigin;
});

test('serves Activity HTML and preserves nested browser routes', async () => {
  for (const path of ['/', '/games/pong']) {
    const response = await fetch(`${origin}${path}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toContain('/@vite/client');
  }
});

test('allows the configured tunnel hostname and rejects unrelated hosts', async () => {
  expect(
    (await fetch(origin, { headers: { Host: 'dev.example.com' } })).status,
  ).toBe(200);
  expect(
    (await fetch(origin, { headers: { Host: 'untrusted.example.com' } }))
      .status,
  ).toBe(403);
});

test('forwards API requests as JSON instead of returning SPA HTML', async () => {
  const response = await fetch(`${origin}/api/health`);
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('application/json');
  expect(await response.json()).toEqual({ status: 'ok' });
});

test('connects the Vite hot-update socket on the same frontend port', async () => {
  const client = await (await fetch(`${origin}/@vite/client`)).text();
  const token = client.match(/const wsToken = "([^"]+)"/)?.[1];
  expect(token).toBeDefined();
  const socket = new WebSocket(
    `${origin.replace(/^http/, 'ws')}/?token=${token}`,
    'vite-hmr',
  );
  try {
    const connected = await new Promise<unknown>((resolve, reject) => {
      socket.onmessage = (event) => resolve(JSON.parse(String(event.data)));
      socket.onerror = () => reject(new Error('HMR connection failed'));
    });
    expect(connected).toEqual({ type: 'connected' });
  } finally {
    socket.close();
  }
}, 10_000);

test('joins a Colyseus room and exchanges messages through the gateway', async () => {
  const client = new Client(`${origin.replace(/^http/, 'ws')}/colyseus`);
  const room = await client.joinOrCreate('gateway-probe');
  try {
    const reply = new Promise<string>((resolve) =>
      room.onMessage('pong', resolve),
    );
    room.send('ping');
    expect(await reply).toBe('gateway-ok');
  } finally {
    await room.leave();
  }
}, 10_000);

const wordleTest = process.env.TEST_DATABASE_URL ? test : test.skip;

wordleTest(
  'plays Wordle and awards XP through the Vite WebSocket gateway',
  async () => {
    const { randomUUID } = await import('node:crypto');
    const { startWordleGatewayFixture } =
      await import('../api/tests/helpers/wordleGatewayFixture');
    const fixture = await startWordleGatewayFixture();
    let gateway: ViteDevServer | undefined;
    let room: Awaited<ReturnType<Client['joinOrCreate']>> | undefined;
    const originalTarget = process.env.DEV_API_TARGET;
    try {
      process.env.DEV_API_TARGET = fixture.origin;
      gateway = await createServer({
        root: import.meta.dirname,
        configFile: resolve(import.meta.dirname, 'vite.config.ts'),
        logLevel: 'silent',
        server: { port: 0, host: '127.0.0.1' },
      });
      await gateway.listen();
      const gatewayAddress = gateway.httpServer?.address();
      if (!gatewayAddress || typeof gatewayAddress === 'string')
        throw new Error('No Wordle gateway port');
      const origin = `http://127.0.0.1:${gatewayAddress.port}`;
      const directPreflight = await fetch(
        `${fixture.origin}/matchmake/joinOrCreate/match`,
        {
          method: 'OPTIONS',
          headers: {
            origin: 'https://dev.example.com',
            'access-control-request-method': 'POST',
            'access-control-request-headers': 'content-type',
          },
        },
      );
      expect(directPreflight.status).toBe(204);
      expect(directPreflight.headers.get('access-control-allow-origin')).toBe(
        'https://dev.example.com',
      );
      expect(
        directPreflight.headers.get('access-control-allow-credentials'),
      ).toBe('true');
      expect(
        directPreflight.headers
          .get('access-control-allow-headers')
          ?.toLowerCase(),
      ).toContain('content-type');
      const preflight = await fetch(
        `${origin}/colyseus/matchmake/joinOrCreate/match`,
        {
          method: 'OPTIONS',
          headers: {
            origin,
            'access-control-request-method': 'POST',
            'access-control-request-headers': 'content-type',
          },
        },
      );
      expect(preflight.status).toBe(204);
      expect(preflight.headers.get('access-control-allow-origin')).toBe(origin);
      room = await new Client(
        `ws://127.0.0.1:${gatewayAddress.port}/colyseus`,
      ).joinOrCreate('match', {
        token: fixture.token,
        roomKey: fixture.key,
        game: 'wordle',
      });
      const ready = new Promise<void>((resolve) =>
        room!.onMessage('init', () => resolve()),
      );
      room.send('wordle_sync');
      await ready;
      const result = new Promise<{
        solved: boolean;
        achievementUpdate: { unlockedIds: string[] };
      }>((resolve) => room!.onMessage('guess_result', resolve));
      room.send('guess', {
        guess: 'termo',
        date: fixture.date,
        requestId: randomUUID(),
        captureAchievementBaseline: true,
      });
      const response = await result;
      expect(response.solved).toBe(true);
      expect(response.achievementUpdate.unlockedIds).toContain(
        'wordle_v2_solved_exactly_1',
      );
      expect(await fixture.persistence()).toEqual({ unlocks: 1, xp: 150 });
    } finally {
      await room?.leave();
      await gateway?.close();
      await fixture.close();
      if (originalTarget === undefined) delete process.env.DEV_API_TARGET;
      else process.env.DEV_API_TARGET = originalTarget;
    }
  },
  30_000,
);
