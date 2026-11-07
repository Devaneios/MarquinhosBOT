import { Controller, Get } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { ActivityAuth } from 'common/decorators/auth.decorators';
import { CurrentUser } from 'common/decorators/current-user.decorator';
import { ActivityAuthGuard } from 'common/guards/activity-auth.guard';
import { HttpInfrastructureModule } from 'common/http/http-infrastructure.module';
import {
  DiscordService,
  type DiscordUser,
} from 'integrations/discord/discord.service';
import {
  createNestHttpTestApp,
  type NestHttpTestApp,
} from './helpers/createNestHttpTestApp';

@Controller('activity-token-probe')
class ActivityTokenProbeController {
  @Get()
  @ActivityAuth()
  check(@CurrentUser() user: DiscordUser) {
    return { userId: user.id };
  }
}

describe('ActivityAuthGuard', () => {
  let api: NestHttpTestApp;
  let result: DiscordUser | null | Error;
  let lookups: string[];

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    result = { id: 'user-1' };
    lookups = [];
    api = await createNestHttpTestApp({
      imports: [HttpInfrastructureModule],
      controllers: [ActivityTokenProbeController],
      providers: [
        ActivityAuthGuard,
        {
          provide: DiscordService,
          useValue: {
            getDiscordUser: async (token: string) => {
              lookups.push(token);
              if (result instanceof Error) throw result;
              return result;
            },
          },
        },
      ],
    });
  });

  afterEach(async () => {
    await api?.close();
  });

  it('validates the raw Activity token and attaches its Discord user', async () => {
    const response = await fetch(`${api.origin}/api/activity-token-probe`, {
      headers: { authorization: 'Bearer activity-access-token' },
    });

    expect(lookups).toEqual(['activity-access-token']);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ userId: 'user-1' });
  });

  it('rejects an invalid raw Activity access token', async () => {
    result = null;
    const response = await fetch(`${api.origin}/api/activity-token-probe`, {
      headers: { authorization: 'Bearer invalid-token' },
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: 'Unauthorized' });
  });
});
