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
