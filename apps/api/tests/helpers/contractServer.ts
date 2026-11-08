import type { ModuleMetadata } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import type { Express } from 'express';
import { AppConfig } from '../../src/config/app.config';
import { createTestAppConfig } from './testAppConfig';

process.env.MARQUINHOS_API_KEY = 'contract-test-key';

export async function startContractServer(mount: (app: Express) => void) {
  // Other test files can clear this process-wide variable after their guards run.
  // Re-establish the fixture for each legacy Express server, not only at import time.
  process.env.MARQUINHOS_API_KEY = 'contract-test-key';
  const { default: express } = await import('express');
  const { runMigrations } = await import('@marquinhos/database/migrate');
  const { HttpClient } = await import('@marquinhos/api-client/bot');
  await runMigrations();

  const app = express();
  app.use(express.json());
  mount(app);

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Contract server has no port');
  }

  const http = new HttpClient({
    baseURL: `http://127.0.0.1:${address.port}`,
    headers: { Authorization: 'Bearer contract-test-key' },
    retries: 0,
  });

  return {
    http,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

export async function startNestContractServer(
  metadata: ModuleMetadata,
  customize: (builder: TestingModuleBuilder) => TestingModuleBuilder = (b) => b,
  clientHeaders: Record<string, string> = {},
) {
  process.env.MARQUINHOS_API_KEY = 'contract-test-key';
  const [
    { configureHttp },
    { NEST_APP_OPTIONS },
    { HttpInfrastructureModule },
    { runMigrations },
    { HttpClient },
  ] = await Promise.all([
    import('common/http/configure-http'),
    import('common/http/nest-app.options'),
    import('common/http/http-infrastructure.module'),
    import('@marquinhos/database/migrate'),
    import('@marquinhos/api-client/bot'),
  ]);
  const moduleRef = await customize(
    Test.createTestingModule({
      ...metadata,
      imports: [HttpInfrastructureModule, ...(metadata.imports ?? [])],
    })
      .overrideProvider(AppConfig)
      .useValue(
        createTestAppConfig({ MARQUINHOS_API_KEY: 'contract-test-key' }),
      ),
  ).compile();
  const app =
    moduleRef.createNestApplication<NestExpressApplication>(NEST_APP_OPTIONS);
  configureHttp(app, { silent: true });
  await runMigrations();
  const server = await app.listen(0, '127.0.0.1');
  const address = server.address();
  if (!address || typeof address === 'string') {
    await app.close();
    throw new Error('Contract server has no port');
  }

  const origin = `http://127.0.0.1:${address.port}`;
  const http = new HttpClient({
    baseURL: origin,
    headers: {
      Authorization: 'Bearer contract-test-key',
      ...clientHeaders,
    },
    retries: 0,
  });
  return {
    http,
    origin,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
