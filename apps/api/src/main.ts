import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from 'app.module';
import { configureHttp } from 'common/http/configure-http';
import { NEST_APP_OPTIONS } from 'common/http/nest-app.options';
import { JsonLogger } from 'common/logging/json-logger.service';
import { AppConfig } from 'config/app.config';
import { GameServer } from 'realtime/game-server.service';
import 'reflect-metadata';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    NEST_APP_OPTIONS,
  );
  app.useLogger(app.get(JsonLogger));
  configureHttp(app);
  app.enableShutdownHooks();
  await app.init();
  await app.get(GameServer).listen(app.get(AppConfig).httpPort);
}

bootstrap().catch((error: unknown) => {
  console.error('Fatal: startup failed', error);
  process.exit(1);
});
