import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { Router } from 'express';
import type { Server } from 'node:http';

export async function getLegacyRouteMounts() {
  const [
    health,
    activity,
    privacyPolicy,
    aiChat,
    emojiReaction,
    gamification,
    evolutiveAchievements,
    maze,
    wordle,
  ] = await Promise.all([
    import('routes/health.route'),
    import('routes/activity.route'),
    import('routes/privacyPolicy.route'),
    import('routes/aiChat.route'),
    import('routes/emojiReaction.route'),
    import('routes/gamification.route'),
    import('routes/evolutiveAchievements.route'),
    import('routes/maze.route'),
    import('routes/wordle.route'),
  ]);

  return [
    { mount: '/api/health', router: health.default, contractModule: 'health' },
    {
      mount: '/api/activities',
      router: activity.default,
      contractModule: 'activity',
    },
    {
      mount: '/api/privacy-policy',
      router: privacyPolicy.default,
      contractModule: 'privacyPolicy',
    },
    { mount: '/api/ai-chat', router: aiChat.default, contractModule: 'aiChat' },
    {
      mount: '/api/emoji-reaction',
      router: emojiReaction.default,
      contractModule: 'emojiReaction',
    },
    {
      mount: '/api/gamification',
      router: gamification.default,
      contractModule: 'gamification',
    },
    {
      mount: '/api/evolutive-achievements',
      router: evolutiveAchievements.default,
      contractModule: 'evolutiveAchievements',
    },
    { mount: '/api/games/maze', router: maze.default, contractModule: 'maze' },
    { mount: '/api/wordle', router: wordle.default, contractModule: 'wordle' },
  ] satisfies {
    mount: string;
    router: Router;
    contractModule: string;
  }[];
}

export interface StartApiOptions {
  corsOrigins?: string[];
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
  if (options.corsOrigins) {
    process.env.CORS_ORIGINS = options.corsOrigins.join(',');
  }

  const [
    { configureHttp },
    { NEST_APP_OPTIONS },
    { HttpInfrastructureModule },
    { AuthModule },
    { HealthModule },
    { PrivacyPolicyModule },
    { ScrobbleModule },
    { UserModule },
    { registerLegacyRoutes },
  ] = await Promise.all([
    import('common/http/configure-http'),
    import('common/http/nest-app.options'),
    import('common/http/http-infrastructure.module'),
    import('modules/auth/auth.module'),
    import('modules/health/health.module'),
    import('modules/privacy-policy/privacy-policy.module'),
    import('modules/scrobble/scrobble.module'),
    import('modules/user/user.module'),
    import('../../src/legacyRoutes'),
  ]);

  const moduleRef = await Test.createTestingModule({
    imports: [
      HttpInfrastructureModule,
      AuthModule,
      HealthModule,
      PrivacyPolicyModule,
      ScrobbleModule,
      UserModule,
    ],
  }).compile();
  const app =
    moduleRef.createNestApplication<NestExpressApplication>(NEST_APP_OPTIONS);
  configureHttp(app, { silent: options.silent });
  registerLegacyRoutes(app);
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
