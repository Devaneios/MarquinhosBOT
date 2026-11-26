import { errorBodySchema } from '@marquinhos/contracts/http/contract';

import {
  type EndpointContract,
  type HttpHeaderDocumentation,
} from '@marquinhos/contracts/http/contract';
import { Glob } from 'bun';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import { z } from 'zod';

const METHODS = new Set(['Get', 'Post', 'Put', 'Patch', 'Delete']);
const controllerRoot = resolve(import.meta.dir, '../../src/modules');
const contractsRoot = resolve(
  import.meta.dir,
  '../../../../packages/contracts/src/http/routes',
);

function routeKey(method: string, path: string) {
  return [method, path].join(' ');
}

function decorators(node: ts.Node) {
  if (!ts.canHaveDecorators(node)) return [];
  return (ts.getDecorators(node) ?? []).flatMap(({ expression }) =>
    ts.isCallExpression(expression) && ts.isIdentifier(expression.expression)
      ? [{ name: expression.expression.text, args: expression.arguments }]
      : [],
  );
}

function literalPath(args: readonly ts.Expression[], source: ts.SourceFile) {
  if (args.length === 0) return '';
  const [path] = args;
  if (args.length !== 1 || !path || !ts.isStringLiteral(path)) {
    throw new Error(
      `Cannot extract nonliteral route path in ${source.fileName}`,
    );
  }
  return path.text;
}

async function readControllerRoutes() {
  const routes = new Set<string>();
  for await (const file of new Glob('**/*controller.ts').scan(controllerRoot)) {
    const source = ts.createSourceFile(
      file,
      await Bun.file(resolve(controllerRoot, file)).text(),
      ts.ScriptTarget.Latest,
      true,
    );
    for (const statement of source.statements) {
      if (!ts.isClassDeclaration(statement)) continue;
      const controller = decorators(statement).find(
        ({ name }) => name === 'Controller',
      );
      if (!controller) continue;
      const prefix = literalPath(controller.args, source);
      for (const member of statement.members) {
        for (const { name, args } of decorators(member)) {
          if (!METHODS.has(name)) continue;
          const path = ['api', prefix, literalPath(args, source)]
            .filter(Boolean)
            .join('/');
          const key = routeKey(name.toUpperCase(), `/${path}`);
          if (routes.has(key))
            throw new Error(`Duplicate controller route ${key}`);
          routes.add(key);
        }
      }
    }
  }
  return routes;
}

function isEndpointContract(value: unknown): value is EndpointContract {
  return (
    typeof value === 'object' &&
    value !== null &&
    'method' in value &&
    typeof value.method === 'string' &&
    'path' in value &&
    typeof value.path === 'string' &&
    value.path.startsWith('/api/') &&
    'response' in value &&
    value.response instanceof z.ZodType
  );
}

async function readContracts() {
  const contracts = new Map<
    string,
    { symbol: string; contract: EndpointContract }
  >();
  const files = Array.from(new Glob('*.ts').scanSync(contractsRoot)).sort();
  for (const file of files) {
    const exports: Record<string, unknown> = await import(
      resolve(contractsRoot, file)
    );
    for (const [name, contract] of Object.entries(exports)) {
      if (!isEndpointContract(contract)) continue;
      const key = routeKey(contract.method, contract.path);
      if (contracts.has(key)) throw new Error(`Duplicate contract ${key}`);
      contracts.set(key, { symbol: `${file.slice(0, -3)}_${name}`, contract });
    }
  }
  return contracts;
}

function schemaFor(schema: z.ZodType, io: 'input' | 'output' = 'input') {
  const { $schema: dialect, ...wireSchema } = z.toJSONSchema(schema, {
    target: 'draft-2020-12',
    io,
    reused: 'inline',
    unrepresentable: ({ zodSchema }) =>
      zodSchema instanceof z.ZodDate && io === 'output'
        ? { type: 'string', format: 'date-time' }
        : 'throw',
  });
  void dialect;
  return wireSchema;
}

function headerFor({
  description,
  schema,
  example,
  required,
}: HttpHeaderDocumentation) {
  schema.parse(example);
  return { description, schema: schemaFor(schema), example, required };
}

const securitySchemes = {
  botBearer: {
    type: 'http',
    scheme: 'bearer',
    description: 'Shared credential issued to the Discord bot.',
  },
  discordUserBearer: {
    type: 'http',
    scheme: 'bearer',
    description:
      'Encrypted Discord access token issued by the account login or refresh operation.',
  },
  discordActivityBearer: {
    type: 'http',
    scheme: 'bearer',
    description:
      'Discord OAuth access token issued by the Activity code exchange.',
  },
  refreshTokenHeader: {
    type: 'apiKey',
    in: 'header',
    name: 'Refresh-Token',
  },
};

function parametersFor(
  location: 'path' | 'query',
  schema: z.ZodType | undefined,
  example: Record<string, unknown> | undefined,
) {
  if (!schema) return [];
  schema.parse(example);
  // Query values enter Express as text. Use the parsed shape for coercing
  // fields so OpenAPI clients can serialize numbers into query strings.
  const { properties } = schemaFor(
    schema,
    location === 'query' ? 'output' : 'input',
  );
  if (!properties)
    throw new Error(`Expected object schema for ${location} parameters`);
  type OpenApiParameter = {
    name: string;
    in: 'path' | 'query';
    required: boolean;
    schema: unknown;
    example?: unknown;
  };
  return Object.entries(properties).map(
    ([name, property]): OpenApiParameter => {
      const remaining = { ...example };
      delete remaining[name];
      return {
        name,
        in: location,
        required: location === 'path' || !schema.safeParse(remaining).success,
        schema: property,
        example: example?.[name],
      };
    },
  );
}

function operationFor(operationId: string, contract: EndpointContract) {
  const docs = contract.docs;
  if (!docs?.description.trim() || docs.tags.length === 0) {
    throw new Error('Missing operation description or tags');
  }
  if (
    Object.keys(docs.success).length === 0 ||
    Object.keys(docs.errors).length === 0
  ) {
    throw new Error(
      'Operation requires documented success and error responses',
    );
  }

  const parameters = [
    ...parametersFor('path', contract.params, docs.examples?.params),
    ...parametersFor('query', contract.query, docs.examples?.query),
    ...Object.entries(docs.requestHeaders ?? {})
      .filter(
        ([name]) =>
          !docs.security.includes('refreshTokenHeader') ||
          name.toLowerCase() !== 'refresh-token',
      )
      .map(([name, header]) => ({ name, in: 'header', ...headerFor(header) })),
  ];

  let requestBody;
  if (contract.body) {
    const example = docs.examples?.body;
    contract.body.parse(example);
    requestBody = {
      required: true,
      content: {
        'application/json': { schema: schemaFor(contract.body), example },
      },
    };
  }

  const responses: Record<string, object> = {};
  for (const [
    status,
    { description, example, headers, contentType, schema = contract.response },
  ] of Object.entries(docs.success)) {
    if (
      !/^2\d\d$/.test(status) ||
      !description.trim() ||
      example === undefined
    ) {
      throw new Error(`Invalid success response metadata for HTTP ${status}`);
    }
    schema.parse(example);
    responses[status] = {
      description,
      ...(headers && {
        headers: Object.fromEntries(
          Object.entries(headers).map(([name, header]) => [
            name,
            headerFor(header),
          ]),
        ),
      }),
      content: {
        [contentType ?? 'application/json']: {
          schema: schemaFor(schema, 'output'),
          example,
        },
      },
    };
  }
  for (const [
    status,
    { description, example, schema = errorBodySchema },
  ] of Object.entries(docs.errors)) {
    if (!/^[45]\d\d$/.test(status) || !description.trim()) {
      throw new Error(`Invalid error response metadata for HTTP ${status}`);
    }
    schema.parse(example);
    responses[status] = {
      description,
      content: {
        'application/json': { schema: schemaFor(schema), example },
      },
    };
  }

  return {
    operationId,
    description: docs.description,
    tags: docs.tags,
    security: docs.security
      .filter((name) => name in securitySchemes)
      .map((name) => ({ [name]: [] })),
    ...(docs.security.includes('discordActivityBody') && {
      'x-authentication': {
        type: 'discordActivityAccessToken',
        in: 'body',
        name: 'accessToken',
      },
    }),
    parameters,
    requestBody,
    responses,
  };
}

export async function buildOpenApi() {
  const [routes, contracts] = await Promise.all([
    readControllerRoutes(),
    readContracts(),
  ]);
  const errors: string[] = [];
  for (const key of [...routes].sort()) {
    if (!contracts.has(key)) errors.push(`${key}: missing HTTP contract`);
  }

  const paths: Record<string, Record<string, object>> = {};
  for (const [key, { contract, symbol }] of [...contracts].sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  )) {
    if (!routes.has(key)) {
      errors.push(`${key}: contract has no controller route`);
      continue;
    }
    try {
      const path = contract.path.replace(/:(\w+)/g, '{$1}');
      (paths[path] ??= {})[contract.method.toLowerCase()] = operationFor(
        symbol,
        contract,
      );
    } catch (error) {
      errors.push(
        `${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  if (errors.length > 0) throw new Error(errors.join('\n'));

  return {
    openapi: '3.1.0',
    info: { title: 'Marquinhos HTTP API', version: '1.0.0' },
    paths,
    components: { securitySchemes },
  };
}

async function validateOpenApi(contents: string) {
  const directory = await mkdtemp(resolve(tmpdir(), 'marquinhos-openapi-'));
  const candidate = resolve(directory, 'openapi.json');
  try {
    await writeFile(candidate, contents);
    const result = Bun.spawnSync(
      [
        resolve(import.meta.dir, '../../../../node_modules/.bin/redocly'),
        'lint',
        '--config',
        resolve(import.meta.dir, 'redocly.yaml'),
        candidate,
      ],
      {
        env: { ...process.env, REDOCLY_TELEMETRY: 'off' },
        stdout: 'inherit',
        stderr: 'inherit',
      },
    );
    if (!result.success) throw new Error('OpenAPI lint failed');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const output = resolve(process.argv[2] ?? 'openapi.json');
  const spec = await buildOpenApi();
  const contents = `${JSON.stringify(spec, null, 2)}\n`;
  await validateOpenApi(contents);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, contents);
}
