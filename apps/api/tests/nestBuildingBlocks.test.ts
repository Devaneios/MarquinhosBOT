import { defineContract } from '@marquinhos/contracts/http/contract';
import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import {
  ActivityAuth,
  ActivityGuildMember,
  ActivityRateLimit,
  BotAuth,
} from 'common/decorators/auth.decorators';
import {
  ContractInput,
  type ContractInputValue,
} from 'common/decorators/contract-input.decorator';
import { CurrentUser } from 'common/decorators/current-user.decorator';
import { OnRouteError } from 'common/decorators/on-route-error.decorator';
import { ApiExceptionFilter } from 'common/filters/api-exception.filter';
import { ActivityAuthGuard } from 'common/guards/activity-auth.guard';
import { BotAuthGuard } from 'common/guards/bot-auth.guard';
import { GuildMemberGuard } from 'common/guards/guild-member.guard';
import { SharedBucketThrottlerGuard } from 'common/guards/shared-bucket-throttler.guard';
import { RouteErrorInterceptor } from 'common/interceptors/route-error.interceptor';
import { AppConfig } from 'config/app.config';
import {
  DiscordService,
  type DiscordUser,
} from 'integrations/discord/discord.service';
import 'reflect-metadata';
import { z } from 'zod';

const inputContract = defineContract({
  method: 'POST',
  path: '/api/test/input/:guildId',
  params: z.object({ guildId: z.string().min(2) }),
  query: z.object({ limit: z.coerce.number().int() }),
  body: z.object({ name: z.string().min(3) }),
  response: z.object({ accepted: z.boolean() }),
});

interface TestRequestUser extends DiscordUser {
  id: string;
}

@Controller('test')
class BuildingBlocksController {
  @Get('bot')
  @BotAuth()
  botAuth() {
    return { accepted: true };
  }

  @Get('activity-user')
  @ActivityAuth()
  activityUser(@CurrentUser() user: TestRequestUser) {
    return { userId: user.id };
  }

  @Get('guild/:guildId')
  @ActivityGuildMember()
  guildMember(@CurrentUser() user: TestRequestUser) {
    return { userId: user.id };
  }

  @Post('input/:guildId')
  @HttpCode(200)
  input(
    @ContractInput(inputContract)
    input: ContractInputValue<typeof inputContract>,
  ) {
    return {
      accepted: true,
      guildId: input.params.guildId,
      limit: input.query.limit,
      name: input.body.name,
    };
  }

  @Get('route-error')
  @OnRouteError({ event: 'test.route_failed', message: 'Unknown Error' })
  routeError(): never {
    throw new Error('private failure');
  }

  @Post('throttle/first')
  @HttpCode(200)
  @ActivityRateLimit()
  throttleFirst() {
    return { accepted: true };
  }

  @Post('throttle/second')
  @HttpCode(200)
  @ActivityRateLimit()
  throttleSecond() {
    return { accepted: true };
  }
}

describe('Nest HTTP building blocks', () => {
  let app: NestExpressApplication;
  let origin: string;
  let memberLookup: (token: string, guildId: string) => Promise<boolean>;
  let userLookup: (token: string) => Promise<DiscordUser | null>;
  const config = { marquinhosApiKey: 'test-key' } as AppConfig;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    userLookup = async (token) => {
      if (token === 'lookup-error') throw new Error('Discord down');
      if (token === 'missing-user') return null;
      return { id: `user-${token}` };
    };
    memberLookup = async (token) => {
      if (token === 'member-error') throw new Error('Discord down');
      return token !== 'not-member';
    };

    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 20 }]),
      ],
      controllers: [BuildingBlocksController],
      providers: [
        { provide: AppConfig, useValue: config },
        {
          provide: DiscordService,
          useValue: {
            getDiscordUser: (token: string) => userLookup(token),
            isGuildMember: (token: string, guildId: string) =>
              memberLookup(token, guildId),
          },
        },
        BotAuthGuard,
        ActivityAuthGuard,
        GuildMemberGuard,
        SharedBucketThrottlerGuard,
        RouteErrorInterceptor,
        ApiExceptionFilter,
        { provide: APP_FILTER, useExisting: ApiExceptionFilter },
        { provide: APP_INTERCEPTOR, useExisting: RouteErrorInterceptor },
      ],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.setGlobalPrefix('api');
    app.useBodyParser('json');
    await app.init();
    const server = await app.listen(0, '127.0.0.1');
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Building-block API did not bind a TCP port');
    }
    origin = `http://127.0.0.1:${address.port}`;
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  async function call(
    path: string,
    options: RequestInit = {},
  ): Promise<{ status: number; body: unknown; headers: Headers }> {
    const response = await fetch(`${origin}/api/test/${path}`, options);
    const text = await response.text();
    return {
      status: response.status,
      body: text ? JSON.parse(text) : undefined,
      headers: response.headers,
    };
  }

  test('BotAuth accepts any scheme and preserves its three failure responses', async () => {
    expect(await call('bot')).toMatchObject({
      status: 401,
      body: { message: 'Token not provided' },
    });
    expect(
      await call('bot', { headers: { authorization: 'Bearer wrong-key' } }),
    ).toMatchObject({ status: 401, body: { message: 'Token not authorized' } });
    expect(
      await call('bot', { headers: { authorization: 'Basic test-key' } }),
    ).toMatchObject({ status: 200, body: { accepted: true } });
  });

  test('ActivityAuth requires the exact Bearer scheme and maps Discord outcomes', async () => {
    expect(
      await call('activity-user', {
        headers: { authorization: 'basic good' },
      }),
    ).toMatchObject({ status: 401, body: { message: 'Token not provided' } });
    expect(
      await call('activity-user', {
        headers: { authorization: 'Bearer missing-user' },
      }),
    ).toMatchObject({ status: 401, body: { message: 'Unauthorized' } });
    expect(
      await call('activity-user', {
        headers: { authorization: 'Bearer lookup-error' },
      }),
    ).toMatchObject({
      status: 500,
      body: { message: 'Internal Server Error' },
    });
    expect(
      await call('activity-user', {
        headers: { authorization: 'Bearer accepted' },
      }),
    ).toMatchObject({ status: 200, body: { userId: 'user-accepted' } });
  });

  test('GuildMember preserves member, non-member, and Discord-failure responses', async () => {
    expect(
      await call('guild/123', {
        headers: { authorization: 'Bearer accepted' },
      }),
    ).toMatchObject({ status: 200, body: { userId: 'user-accepted' } });
    expect(
      await call('guild/123', {
        headers: { authorization: 'Bearer not-member' },
      }),
    ).toMatchObject({
      status: 403,
      body: { message: 'Not a community member' },
    });
    expect(
      await call('guild/123', {
        headers: { authorization: 'Bearer member-error' },
      }),
    ).toMatchObject({
      status: 503,
      body: { message: 'Discord membership unavailable' },
    });
  });

  test('ContractInput aggregates params, query, and body issues with prefixed paths', async () => {
    expect(
      await call('input/g?limit=not-a-number', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'x' }),
      }),
    ).toMatchObject({
      status: 400,
      body: {
        message: 'Validation failed',
        errors: [
          { path: 'params.guildId' },
          { path: 'query.limit' },
          { path: 'body.name' },
        ],
      },
    });
  });

  test('OnRouteError keeps the configured 500 message', async () => {
    expect(await call('route-error')).toMatchObject({
      status: 500,
      body: { message: 'Unknown Error' },
    });
  });

  test('the activity throttle bucket is shared across different handlers', async () => {
    for (let index = 0; index < 20; index += 1) {
      const path = index % 2 === 0 ? 'throttle/first' : 'throttle/second';
      expect(
        await call(path, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        }),
      ).toMatchObject({ status: 200 });
    }
    expect(
      await call('throttle/second', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
    ).toMatchObject({
      status: 429,
      body: { message: 'Too many requests, please try again later.' },
    });
  });
});
