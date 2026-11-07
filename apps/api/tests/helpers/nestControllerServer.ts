import type { ModuleMetadata } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { ActivityAuthGuard } from '../../src/common/guards/activity-auth.guard';
import { BotAuthGuard } from '../../src/common/guards/bot-auth.guard';
import { GuildMemberGuard } from '../../src/common/guards/guild-member.guard';
import { configureHttp } from '../../src/common/http/configure-http';
import { HttpInfrastructureModule } from '../../src/common/http/http-infrastructure.module';
import { NEST_APP_OPTIONS } from '../../src/common/http/nest-app.options';
import { ConfigModule } from '../../src/config/config.module';
import type { DiscordUser } from '../../src/integrations/discord/discord.service';
import { DiscordService } from '../../src/integrations/discord/discord.service';

const activityToken = 'controller-test-token';
const testUser = { id: 'owner' } as DiscordUser;

export async function startNestControllerServer(
  metadata: ModuleMetadata,
  customize: (builder: TestingModuleBuilder) => TestingModuleBuilder = (b) => b,
) {
  process.env.MARQUINHOS_API_KEY = activityToken;
  const builder = Test.createTestingModule({
    ...metadata,
    imports: [
      ConfigModule,
      HttpInfrastructureModule,
      ...(metadata.imports ?? []),
    ],
    providers: [
      ...(metadata.providers ?? []),
      ActivityAuthGuard,
      BotAuthGuard,
      GuildMemberGuard,
      {
        provide: DiscordService,
        useValue: {
          getDiscordUser: async (token: string) =>
            token === activityToken ? testUser : null,
          isGuildMember: async () => true,
        },
      },
    ],
  });
  const moduleRef = await customize(builder).compile();
  const app =
    moduleRef.createNestApplication<NestExpressApplication>(NEST_APP_OPTIONS);
  configureHttp(app, { silent: true });
  const server = await app.listen(0, '127.0.0.1');
  const address = server.address();
  if (!address || typeof address === 'string') {
    await app.close();
    throw new Error('Test API did not bind to a TCP port');
  }

  return {
    origin: `http://127.0.0.1:${address.port}`,
    activityToken,
    close: () => app.close(),
  };
}

export async function requestController(
  server: Awaited<ReturnType<typeof startNestControllerServer>>,
  path: string,
  options: { method?: string; body?: unknown; token?: string } = {},
) {
  const response = await fetch(`${server.origin}/api${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.token === undefined
        ? { authorization: `Bearer ${server.activityToken}` }
        : options.token
          ? { authorization: options.token }
          : {}),
      ...(options.body === undefined
        ? {}
        : { 'content-type': 'application/json' }),
    },
    ...(options.body === undefined
      ? {}
      : { body: JSON.stringify(options.body) }),
  });
  return {
    status: response.status,
    body: await response.json().catch(() => undefined),
  };
}
