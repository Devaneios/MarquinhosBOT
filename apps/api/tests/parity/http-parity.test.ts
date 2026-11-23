import { RequestMethod } from '@nestjs/common';
import {
  GUARDS_METADATA,
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { DiscoveryService, ModulesContainer } from '@nestjs/core';
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

const PARITY_CONFIG = {
  NODE_ENV: 'test',
  MARQUINHOS_API_KEY: 'parity-capture-key',
  MARQUINHOS_SECRET_KEY: 'parity-capture-secret',
  MARQUINHOS_CRYPTO_SALT: 'parity-capture-salt',
  DISCORD_CLIENT_ID: 'parity-discord-client-id',
  DISCORD_CLIENT_SECRET: 'parity-discord-client-secret',
  DISCORD_REDIRECT_URI: 'https://parity.example/discord/callback',
  LASTFM_API_KEY: 'parity-lastfm-api-key',
  LASTFM_SHARED_SECRET: 'parity-lastfm-secret',
  LASTFM_REDIRECT_URI: 'https://parity.example/lastfm/callback',
};

const { startApi } = await import('../helpers/startApi');
let api: Awaited<ReturnType<typeof startApi>>;
let nextProbeIpNumber = 1;

function nextProbeIp(): string {
  const value = nextProbeIpNumber++;
  return `198.51.${Math.floor(value / 250)}.${(value % 250) + 1}`;
}

beforeAll(async () => {
  api = await startApi({
    config: PARITY_CONFIG,
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

const METHOD_NAMES: Record<number, string> = {
  [RequestMethod.GET]: 'GET',
  [RequestMethod.POST]: 'POST',
  [RequestMethod.PUT]: 'PUT',
  [RequestMethod.DELETE]: 'DELETE',
  [RequestMethod.PATCH]: 'PATCH',
  [RequestMethod.OPTIONS]: 'OPTIONS',
  [RequestMethod.HEAD]: 'HEAD',
};

const GUARD_NAMES: Record<string, string> = {
  botAuth: 'BotAuthGuard',
  discordUserAuth: 'DiscordUserAuthGuard',
  activityAuth: 'ActivityAuthGuard',
  guildMember: 'GuildMemberGuard',
  rateLimit: 'SharedBucketThrottlerGuard',
};

function routeSegments(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  return values.flatMap((part) =>
    typeof part === 'string' ? part.split('/').filter(Boolean) : [],
  );
}

function discoverNestRoutes() {
  const discovery = new DiscoveryService(api.app.get(ModulesContainer));
  return discovery
    .getControllers()
    .flatMap((wrapper) => {
      const controller = wrapper.metatype;
      if (!controller) return [];
      const prototype = controller.prototype as Record<string, unknown>;
      const controllerPath = Reflect.getMetadata(PATH_METADATA, controller);
      return Object.getOwnPropertyNames(prototype).flatMap((name) => {
        if (name === 'constructor') return [];
        const handler = prototype[name];
        if (typeof handler !== 'function') return [];
        const routePath = Reflect.getMetadata(PATH_METADATA, handler);
        const method = Reflect.getMetadata(METHOD_METADATA, handler) as
          RequestMethod | undefined;
        if (routePath === undefined || method === undefined) return [];

        const methodName = METHOD_NAMES[method];
        if (!methodName)
          throw new Error(`Unknown Nest request method: ${method}`);
        const path = `/${[
          'api',
          ...routeSegments(controllerPath),
          ...routeSegments(routePath),
        ].join('/')}`;
        const classGuards =
          Reflect.getMetadata(GUARDS_METADATA, controller) ?? [];
        const handlerGuards =
          Reflect.getMetadata(GUARDS_METADATA, handler) ?? [];
        const status =
          Reflect.getMetadata(HTTP_CODE_METADATA, handler) ??
          (methodName === 'POST' ? 201 : 200);
        return [
          {
            id: `${methodName} ${path}`,
            status,
            guards: [...classGuards, ...handlerGuards].map((guard: unknown) =>
              typeof guard === 'function' ? guard.name : String(guard),
            ),
          },
        ];
      });
    })
    .sort((left, right) => left.id.localeCompare(right.id));
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
  test('the route manifest maps every baseline route to exactly one contract', () => {
    expect(manifest.routeCount).toBe(90);
    expect(manifest.contractCount).toBe(90);
    expect(manifest.routes).toHaveLength(90);
    expect(manifest.unmatchedRoutes).toEqual([]);
    expect(manifest.unmatchedContracts).toEqual([]);
    expect(manifest.unclassifiedMiddleware).toEqual([]);
    expect(golden.routeCount).toBe(90);
    expect(
      probes.filter((probe) => probe.id.endsWith('no Authorization')),
    ).toHaveLength(90);
    expect(golden.skippedProbes).toHaveLength(13);
  });

  test('discovered Nest routes match the baseline paths, guards, and status codes', () => {
    const actual = discoverNestRoutes();
    expect(actual).toHaveLength(manifest.routeCount);
    expect(new Set(actual.map((route) => route.id)).size).toBe(actual.length);

    const actualById = new Map(actual.map((route) => [route.id, route]));
    for (const expected of manifest.routes) {
      const route = actualById.get(expected.id);
      expect(route).toBeDefined();
      expect(
        expected.dynamicSuccessStatuses ?? [expected.successStatus],
      ).toContain(route?.status);
      expect(route?.guards).toEqual(
        expected.middlewareChain
          .filter((name: string) => name !== 'validateContract')
          .map((name: string) => GUARD_NAMES[name]),
      );
    }
  });

  test('the live Nest HTTP responses match the committed baseline', async () => {
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
      if (probe.request.path === '/api/auth/discordLoginUrl') {
        const body = actual.body as { data?: unknown };
        expect(typeof body?.data).toBe('string');
        const parsedUrl = new URL(body.data as string);
        const state = parsedUrl.searchParams.get('state');
        expect(state).toBeTruthy();
        parsedUrl.searchParams.delete('state');
        expect(
          {
            ...actual,
            headers: canonicalHeaders(actual.headers),
            body: { ...body, data: parsedUrl.toString() } as unknown,
          },
          probe.id,
        ).toEqual({
          ...probe.response,
          headers: canonicalHeaders(probe.response.headers),
        });
        continue;
      }
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

  test('enforces security headers and body size limits globally', async () => {
    const healthRes = await fetch(new URL('/api/health', api.origin));
    expect(healthRes.status).toBe(200);
    expect(healthRes.headers.get('x-content-type-options')).toBe('nosniff');
    expect(healthRes.headers.get('x-powered-by')).toBeNull();

    const oversized = JSON.stringify({ data: 'a'.repeat(300_000) });
    const tooLarge = await fetch(new URL('/api/activities/token', api.origin), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '203.0.113.222',
      },
      body: oversized,
    });
    expect(tooLarge.status).toBe(413);
  });
});
