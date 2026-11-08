import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import { AppConfig } from '../../src/config/app.config';
import { createTestAppConfig } from './testAppConfig';

export interface StartApiOptions {
  corsOrigins?: string[];
  config?: Record<string, string | undefined>;
  silent?: boolean;
}

export interface StartedApi {
  app: NestExpressApplication;
  http: Server;
  origin: string;
  close: () => Promise<void>;
}

export async function startApi(
  options: StartApiOptions = {},
): Promise<StartedApi> {
  const [
    { configureHttp },
    { NEST_APP_OPTIONS },
    { HttpInfrastructureModule },
    { AuthModule },
    { AiChatModule },
    { EmojiReactionModule },
    { HealthModule },
    { PrivacyPolicyModule },
    { GamificationModule },
    { MazeModule },
    { ScrobbleModule },
    { UserModule },
    { WordleModule },
    { ActivityModule },
  ] = await Promise.all([
    import('common/http/configure-http'),
    import('common/http/nest-app.options'),
    import('common/http/http-infrastructure.module'),
    import('modules/auth/auth.module'),
    import('modules/ai-chat/ai-chat.module'),
    import('modules/emoji-reaction/emoji-reaction.module'),
    import('modules/health/health.module'),
    import('modules/privacy-policy/privacy-policy.module'),
    import('modules/gamification/gamification.module'),
    import('modules/maze/maze.module'),
    import('modules/scrobble/scrobble.module'),
    import('modules/user/user.module'),
    import('modules/wordle/wordle.module'),
    import('modules/activity/activity.module'),
  ]);

  const config = {
    ...options.config,
    ...(options.corsOrigins
      ? { CORS_ORIGINS: options.corsOrigins.join(',') }
      : {}),
  };
  const moduleRef = await Test.createTestingModule({
    imports: [
      HttpInfrastructureModule,
      AuthModule,
      AiChatModule,
      EmojiReactionModule,
      HealthModule,
      PrivacyPolicyModule,
      GamificationModule,
      MazeModule,
      ScrobbleModule,
      UserModule,
      ActivityModule,
      WordleModule,
    ],
  })
    .overrideProvider(AppConfig)
    .useValue(createTestAppConfig(config))
    .compile();
  const app =
    moduleRef.createNestApplication<NestExpressApplication>(NEST_APP_OPTIONS);
  configureHttp(app, { silent: options.silent });
  await app.init();
  const http = await app.listen(0, '127.0.0.1');
  const address = http.address();
  if (!address || typeof address === 'string') {
    await app.close();
    throw new Error('Test API did not bind to a TCP port');
  }

  return {
    app,
    http,
    origin: `http://127.0.0.1:${address.port}`,
    close: () => app.close(),
  };
}
