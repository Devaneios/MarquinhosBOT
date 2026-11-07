import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

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

const [{ startApi }, manifest] = await Promise.all([
  import('../../tests/helpers/startApi'),
  Bun.file(join(import.meta.dir, '../../tests/parity/route-manifest.json')).json(),
]);

interface ManifestRoute {
  id: string;
  method: string;
  examplePath: string;
  middlewareChain: string[];
  probes: {
    noAuthorization: string;
    wrongBearer: string;
    authenticatedEmptyBody: string;
  };
}

interface GoldenResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

interface GoldenCase {
  id: string;
  setupRequests?: {
    method: string;
    path: string;
    headers: Record<string, string>;
    body?: string;
  }[];
  request: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    body?: string;
  };
  response: GoldenResponse;
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

let clientIpNumber = 1;
function nextClientIp(): string {
  const third = Math.floor(clientIpNumber / 250);
  const fourth = (clientIpNumber++ % 250) + 1;
  return `198.51.${third}.${fourth}`;
}

function normalizeHeader(name: string, value: string): string {
  if (name === 'ratelimit-reset') return '<reset-seconds>';
  if (name === 'retry-after') return '<retry-seconds>';
  return value;
}

async function request(
  api: Awaited<ReturnType<typeof startApi>>,
  id: string,
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: string,
): Promise<GoldenCase> {
  const requestHeaders = {
    'x-forwarded-for': nextClientIp(),
    ...headers,
  };
  const response = await fetch(new URL(path, api.origin), {
    method,
    headers: requestHeaders,
    body,
  });
  const text = await response.text();
  let responseBody: unknown = text;
  if (text && response.headers.get('content-type')?.includes('application/json')) {
    try {
      responseBody = JSON.parse(text);
    } catch {
      responseBody = text;
    }
  } else if (!text) {
    responseBody = null;
  }

  const responseHeaders: Record<string, string> = {};
  for (const header of selectedHeaders) {
    const value = response.headers.get(header);
    if (value !== null) responseHeaders[header] = normalizeHeader(header, value);
  }
  return {
    id,
    request: {
      method,
      path,
      headers: Object.fromEntries(
        Object.entries(requestHeaders).filter(([name]) => name !== 'x-forwarded-for'),
      ),
      body,
    },
    response: { status: response.status, headers: responseHeaders, body: responseBody },
  };
}

const api = await startApi({
  corsOrigins: ['https://allowed.example'],
  silent: true,
});
const cases: (GoldenCase | { id: string; skipped: string })[] = [];
try {
  for (const route of manifest.routes as ManifestRoute[]) {
    const body = ['GET', 'HEAD'].includes(route.method)
      ? undefined
      : JSON.stringify({});
    cases.push(
      await request(
        api,
        `${route.id} :: no Authorization`,
        route.method,
        route.examplePath,
        body ? { 'content-type': 'application/json' } : {},
        body,
      ),
    );

    if (route.probes.wrongBearer === 'capture') {
      cases.push(
        await request(
          api,
          `${route.id} :: wrong bearer`,
          route.method,
          route.examplePath,
          {
            authorization: 'Bearer wrong-token',
            ...(body ? { 'content-type': 'application/json' } : {}),
          },
          body,
        ),
      );
    } else if (route.probes.wrongBearer.startsWith('skip:')) {
      cases.push({
        id: `${route.id} :: wrong bearer`,
        skipped: route.probes.wrongBearer.slice('skip:'.length).trim(),
      });
    }

    if (route.probes.authenticatedEmptyBody.startsWith('capture:')) {
      const isBotAuth = route.middlewareChain.includes('botAuth');
      cases.push(
        await request(
          api,
          `${route.id} :: authenticated empty body`,
          route.method,
          route.examplePath,
          {
            ...(isBotAuth ? { authorization: 'Bearer parity-capture-key' } : {}),
            'content-type': 'application/json',
          },
          JSON.stringify({}),
        ),
      );
    }
  }

  cases.push(
    await request(api, 'extra :: unmatched path', 'GET', '/api/parity-unmatched'),
    await request(api, 'extra :: health', 'GET', '/api/health'),
    await request(api, 'extra :: privacy policy', 'GET', '/api/privacy-policy'),
    await request(
      api,
      'extra :: CORS allowed origin',
      'GET',
      '/api/health',
      { origin: 'https://allowed.example' },
    ),
    await request(
      api,
      'extra :: CORS denied origin',
      'GET',
      '/api/health',
      { origin: 'https://denied.example' },
    ),
    await request(
      api,
      'extra :: Discord login URL',
      'GET',
      '/api/auth/discordLoginUrl',
    ),
  );

  const rateLimitIp = '203.0.113.199';
  for (let index = 0; index < 20; index++) {
    await fetch(new URL('/api/activities/token', api.origin), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': rateLimitIp,
      },
      body: '{}',
    });
  }
  const limitedResponse = await fetch(new URL('/api/activities/ws-session', api.origin), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': rateLimitIp,
    },
    body: '{}',
  });
  const limitedText = await limitedResponse.text();
  const limitedHeaders: Record<string, string> = {};
  for (const header of selectedHeaders) {
    const value = limitedResponse.headers.get(header);
    if (value !== null) limitedHeaders[header] = normalizeHeader(header, value);
  }
  cases.push({
    id: 'extra :: shared activity rate limit across two routes',
    setupRequests: Array.from({ length: 20 }, () => ({
      method: 'POST',
      path: '/api/activities/token',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })),
    request: {
      method: 'POST',
      path: '/api/activities/ws-session',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    },
    response: {
      status: limitedResponse.status,
      headers: limitedHeaders,
      body: limitedText ? JSON.parse(limitedText) : null,
    },
  });
} finally {
  await api.close();
}

const outputPath =
  process.env.PARITY_GOLDEN_OUTPUT ??
  join(import.meta.dir, '../../tests/parity/express-golden.json');
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(
  outputPath,
  `${JSON.stringify(
    {
      generatedFrom: 'Express baseline',
      routeCount: (manifest.routes as ManifestRoute[]).length,
      capturedCases: cases.length,
      skippedProbes: cases.filter((value) => 'skipped' in value),
      cases,
    },
    null,
    2,
  )}\n`,
);
console.log(`Wrote ${cases.length} parity probes to ${outputPath}`);
