import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { join } from 'node:path';

interface GoldenProbe {
  id: string;
  skipped?: string;
  setupRequests?: {
    method: string;
    path: string;
    headers: Record<string, string>;
    body?: string;
  }[];
  request?: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    body?: string;
  };
  response?: {
    status: number;
    headers: Record<string, string>;
    body: unknown;
  };
}

const manifest = await Bun.file(
  join(import.meta.dir, 'route-manifest.json'),
).json();
const golden = await Bun.file(
  join(import.meta.dir, 'express-golden.json'),
).json();
const probes = golden.cases as GoldenProbe[];
const executableProbes = probes.filter(
  (
    probe,
  ): probe is GoldenProbe &
    Required<Pick<GoldenProbe, 'request' | 'response'>> =>
    !!probe.request && !!probe.response,
);

process.env.NODE_ENV = 'test';
process.env.MARQUINHOS_API_KEY = 'parity-capture-key';
process.env.MARQUINHOS_SECRET_KEY = 'parity-capture-secret';
process.env.MARQUINHOS_CRYPTO_SALT = 'parity-capture-salt';
process.env.DISCORD_CLIENT_ID = 'parity-discord-client-id';
process.env.DISCORD_CLIENT_SECRET = 'parity-discord-client-secret';
process.env.DISCORD_REDIRECT_URI = 'https://parity.example/discord/callback';
process.env.LASTFM_API_KEY = 'parity-lastfm-api-key';
process.env.LASTFM_SHARED_SECRET = 'parity-lastfm-secret';
process.env.LASTFM_REDIRECT_URI = 'https://parity.example/lastfm/callback';

const { startApi } = await import('../helpers/startApi');
let api: Awaited<ReturnType<typeof startApi>>;
let nextProbeIpNumber = 1;

function nextProbeIp(): string {
  const value = nextProbeIpNumber++;
  return `198.51.${Math.floor(value / 250)}.${(value % 250) + 1}`;
}

beforeAll(async () => {
  api = await startApi({
    corsOrigins: ['https://allowed.example'],
    silent: true,
  });
}, 30_000);

afterAll(async () => {
  await api?.close();
});

function canonicalHeaders(headers: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(headers).filter(([name]) => name !== 'ratelimit-policy'),
  );
}

async function perform(
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: string,
  ip = nextProbeIp(),
) {
  const response = await fetch(new URL(path, api.origin), {
    method,
    headers: { 'x-forwarded-for': ip, ...headers },
    body,
  });
  const text = await response.text();
  let responseBody: unknown = text;
  if (
    text &&
    response.headers.get('content-type')?.includes('application/json')
  ) {
    try {
      responseBody = JSON.parse(text);
    } catch {
      responseBody = text;
    }
  } else if (!text) {
    responseBody = null;
  }

  const selectedHeaders = [
    'access-control-allow-credentials',
    'access-control-allow-headers',
    'access-control-allow-origin',
    'access-control-expose-headers',
    'authorization',
    'content-type',
    'created-at',
    'expires-in',
    'ratelimit-limit',
    'ratelimit-policy',
    'ratelimit-remaining',
    'ratelimit-reset',
    'refresh-token',
    'retry-after',
  ];
  const responseHeaders = Object.fromEntries(
    selectedHeaders.flatMap((name) => {
      const value = response.headers.get(name);
      return value === null
        ? []
        : [[name, normalizeHeader(name, value)] as const];
    }),
  );

  return {
    status: response.status,
    headers: responseHeaders,
    body: responseBody,
  };
}

function normalizeHeader(name: string, value: string): string {
  if (name === 'ratelimit-reset') return '<reset-seconds>';
  if (name === 'retry-after') return '<retry-seconds>';
  return value;
}

describe('HTTP parity safety net', () => {
  test('the route manifest maps every Express route to exactly one contract', () => {
    expect(manifest.routeCount).toBe(97);
    expect(manifest.contractCount).toBe(97);
    expect(manifest.routes).toHaveLength(97);
    expect(manifest.unmatchedRoutes).toEqual([]);
    expect(manifest.unmatchedContracts).toEqual([]);
    expect(manifest.unclassifiedMiddleware).toEqual([]);
    expect(golden.routeCount).toBe(97);
    expect(
      probes.filter((probe) => probe.id.endsWith('no Authorization')),
    ).toHaveLength(97);
    expect(golden.skippedProbes).toHaveLength(13);
  });

  test('the live Express HTTP responses match the committed baseline', async () => {
    for (const probe of executableProbes) {
      for (const setup of probe.setupRequests ?? []) {
        await perform(
          setup.method,
          setup.path,
          setup.headers,
          setup.body,
          '203.0.113.199',
        );
      }

      const actual = await perform(
        probe.request.method,
        probe.request.path,
        probe.request.headers,
        probe.request.body,
        probe.id.includes('shared activity rate limit')
          ? '203.0.113.199'
          : nextProbeIp(),
      );
      expect(
        {
          ...actual,
          headers: canonicalHeaders(actual.headers),
        },
        probe.id,
      ).toEqual({
        ...probe.response,
        headers: canonicalHeaders(probe.response.headers),
      });
    }
  }, 30_000);
});
