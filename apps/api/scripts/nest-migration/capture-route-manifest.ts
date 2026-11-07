import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EndpointContract } from '@marquinhos/contracts/http/contract';
import * as activity from '@marquinhos/contracts/http/routes/activity';
import * as aiChat from '@marquinhos/contracts/http/routes/aiChat';
import * as auth from '@marquinhos/contracts/http/routes/auth';
import * as emojiReaction from '@marquinhos/contracts/http/routes/emojiReaction';
import * as evolutiveAchievements from '@marquinhos/contracts/http/routes/evolutiveAchievements';
import * as gamification from '@marquinhos/contracts/http/routes/gamification';
import * as health from '@marquinhos/contracts/http/routes/health';
import * as maze from '@marquinhos/contracts/http/routes/maze';
import * as privacyPolicy from '@marquinhos/contracts/http/routes/privacyPolicy';
import * as scrobble from '@marquinhos/contracts/http/routes/scrobble';
import * as user from '@marquinhos/contracts/http/routes/user';
import * as wordle from '@marquinhos/contracts/http/routes/wordle';
import { getLegacyRouteMounts } from '../../tests/helpers/startApi';

interface RuntimeRoute {
  path: string | string[];
  methods: Record<string, boolean>;
  stack: { handle: (...args: never[]) => unknown }[];
}

interface RuntimeLayer {
  route?: RuntimeRoute;
}

interface ContractRecord {
  method: string;
  path: string;
  exportName: string;
  moduleName: string;
}

const contractModules: Record<string, Record<string, unknown>> = {
  activity,
  aiChat,
  auth,
  emojiReaction,
  evolutiveAchievements,
  gamification,
  health,
  maze,
  privacyPolicy,
  scrobble,
  user,
  wordle,
};

const statusOverrides: Record<string, number> = {
  'POST /api/activities/pong/tournaments/create': 201,
  'POST /api/gamification/achievements': 201,
  'POST /api/wordle/admin/goals': 201,
  'POST /api/wordle/admin/bingo': 201,
  'POST /api/wordle/challenges/:guildId': 201,
  'POST /api/ai-chat/research': 202,
};

function isContract(value: unknown): value is EndpointContract {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<EndpointContract>;
  return (
    typeof candidate.method === 'string' &&
    typeof candidate.path === 'string' &&
    candidate.path.startsWith('/api/')
  );
}

function routePaths(routePath: RuntimeRoute['path']): string[] {
  return Array.isArray(routePath) ? routePath : [routePath];
}

function fullPath(mount: string, path: string): string {
  const normalizedMount = mount.replace(/\/$/, '');
  const normalizedPath = path === '/' ? '' : `/${path.replace(/^\//, '')}`;
  return `${normalizedMount}${normalizedPath}` || '/';
}

function classifyMiddleware(
  handle: (...args: never[]) => unknown,
  mount: string,
  routePath: string,
  index: number,
): string {
  const name = handle.name;
  const source = Function.prototype.toString.call(handle);
  if (source.includes('partIssues')) return 'validateContract';
  if (name === 'checkToken') return 'botAuth';
  if (name === 'verifyDiscordToken') return 'discordUserAuth';
  if (name === 'verifyActivityDiscordToken') return 'activityAuth';
  if (name.includes('GuildMember') || source.includes('isGuildMember')) {
    return 'guildMember';
  }
  if (
    mount === '/api/activities' &&
    routePath !== '/deep-link' &&
    index === 0
  ) {
    return 'rateLimit';
  }
  return `unclassified:${name || '<anonymous>'}`;
}

function examplePath(path: string): string {
  return path.replace(/:([A-Za-z][A-Za-z0-9]*)/g, (_match, name: string) => {
    if (name === 'guildId' || name === 'userId' || name === 'id') {
      return '111111111111111111';
    }
    if (name === 'period') return '7day';
    if (name === 'gameType') return 'wordle';
    if (name === 'sessionId') return 'parity-session';
    if (name === 'traceId') return 'parity-trace';
    return `parity-${name}`;
  });
}

const contracts: ContractRecord[] = Object.entries(contractModules).flatMap(
  ([moduleName, exports]) =>
    Object.entries(exports)
      .filter(([, value]) => isContract(value))
      .map(([exportName, value]) => {
        const contract = value as EndpointContract;
        return {
          method: contract.method,
          path: contract.path,
          exportName,
          moduleName,
        };
      }),
);

process.env.NODE_ENV = 'test';
process.env.MARQUINHOS_API_KEY = 'parity-capture-key';
process.env.MARQUINHOS_SECRET_KEY = 'parity-capture-secret';
process.env.MARQUINHOS_CRYPTO_SALT = 'parity-capture-salt';

const legacyRouteMounts = await getLegacyRouteMounts();
const matchedContracts = new Set<string>();
const unclassifiedMiddleware: string[] = [];
const routes = legacyRouteMounts.flatMap(({ mount, router, contractModule }) => {
  const stack = (router as unknown as { stack: RuntimeLayer[] }).stack;
  return stack.flatMap(({ route }) => {
    if (!route) return [];
    return routePaths(route.path).flatMap((localPath) => {
      const path = fullPath(mount, localPath);
      const methods = Object.entries(route.methods)
        .filter(([method, enabled]) => enabled && method !== '_all')
        .map(([method]) => method.toUpperCase());
      return methods.map((method) => {
        const key = `${method} ${path}`;
        const candidates = contracts.filter(
          (contract) => contract.method === method && contract.path === path,
        );
        const contract = candidates.length === 1 ? candidates[0] : undefined;
        if (contract) matchedContracts.add(`${contract.moduleName}.${contract.exportName}`);

        const middlewareChain = route.stack.slice(0, -1).map((layer, index) =>
          classifyMiddleware(layer.handle, mount, localPath, index),
        );
        for (const middleware of middlewareChain) {
          if (middleware.startsWith('unclassified:')) {
            unclassifiedMiddleware.push(`${key}: ${middleware}`);
          }
        }

        return {
          id: key,
          method,
          path,
          mount,
          routerPath: localPath,
          middlewareChain,
          successStatus: statusOverrides[key] ?? 200,
          dynamicSuccessStatuses:
            key === 'POST /api/ai-chat/research' ? [200, 202] : undefined,
          contractExport: contract
            ? `${contract.moduleName}.${contract.exportName}`
            : null,
          contractMatches: candidates.map(
            (candidate) => `${candidate.moduleName}.${candidate.exportName}`,
          ),
          examplePath: examplePath(path),
          probes: {
            noAuthorization: 'capture',
            wrongBearer: middlewareChain.includes('activityAuth')
              ? 'skip: verification may call the Discord API'
              : middlewareChain.some((entry) =>
                    [
                      'botAuth',
                      'discordUserAuth',
                      'activityAuth',
                      'guildMember',
                    ].includes(entry),
                  )
                ? 'capture'
                : 'not-applicable: route has no auth guard',
            authenticatedEmptyBody: middlewareChain.includes('validateContract')
              ? 'capture: contract middleware rejects before the handler'
              : 'skip: route has no pre-handler contract validation',
          },
        };
      });
    });
  });
});

const unmatchedRoutes = routes.filter((route) => route.contractMatches.length !== 1);
const unmatchedContracts = contracts.filter(
  (contract) =>
    !matchedContracts.has(`${contract.moduleName}.${contract.exportName}`),
);
const manifest = {
  generatedFrom: 'Express router stacks and @marquinhos/contracts',
  routeCount: routes.length,
  contractCount: contracts.length,
  routes,
  unmatchedRoutes,
  unmatchedContracts,
  unclassifiedMiddleware,
};

if (routes.length !== 97 || contracts.length !== 97) {
  throw new Error(
    `Expected 97 routes and contracts; found ${routes.length} routes and ${contracts.length} contracts`,
  );
}
if (unmatchedRoutes.length || unmatchedContracts.length) {
  throw new Error(
    `Route/contract mapping is not one-to-one: ${unmatchedRoutes.length} unmatched routes, ${unmatchedContracts.length} unmatched contracts`,
  );
}
if (unclassifiedMiddleware.length) {
  throw new Error(
    `Unclassified route middleware:\n${unclassifiedMiddleware.join('\n')}`,
  );
}

const outputPath = join(import.meta.dir, '../../tests/parity/route-manifest.json');
mkdirSync(join(import.meta.dir, '../../tests/parity'), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `Wrote ${routes.length} routes matched to ${contracts.length} contracts: ${outputPath}`,
);
