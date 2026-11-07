import type { ModuleMetadata } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';

export interface NestHttpTestApp {
  app: NestExpressApplication;
  origin: string;
  close: () => Promise<void>;
}

export async function createNestHttpTestApp(
  metadata: ModuleMetadata,
  customize: (builder: TestingModuleBuilder) => TestingModuleBuilder = (b) => b,
): Promise<NestHttpTestApp> {
  const moduleRef = await customize(
    Test.createTestingModule(metadata),
  ).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  app.setGlobalPrefix('api');
  await app.init();
  const server = await app.listen(0, '127.0.0.1');
  const address = server.address();
  if (!address || typeof address === 'string') {
    await app.close();
    throw new Error('Test API did not bind a TCP port');
  }

  return {
    app,
    origin: `http://127.0.0.1:${address.port}`,
    close: () => app.close(),
  };
}
