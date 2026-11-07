import { Controller, Get } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { ActivityGuildMember } from 'common/decorators/auth.decorators';
import { CurrentUser } from 'common/decorators/current-user.decorator';
import { ActivityAuthGuard } from 'common/guards/activity-auth.guard';
import { GuildMemberGuard } from 'common/guards/guild-member.guard';
import { HttpInfrastructureModule } from 'common/http/http-infrastructure.module';
import { DiscordService, type DiscordUser } from 'services/discord';
import {
  createNestHttpTestApp,
  type NestHttpTestApp,
} from './helpers/createNestHttpTestApp';

@Controller('guild-probe')
class GuildMembershipProbeController {
  @Get('community/:guildId')
  @ActivityGuildMember()
  member(@CurrentUser() user: DiscordUser) {
    return { userId: user.id };
  }

  @Get('community')
  @ActivityGuildMember()
  missingGuild(@CurrentUser() user: DiscordUser) {
    return { userId: user.id };
  }
}

describe('GuildMemberGuard', () => {
  let api: NestHttpTestApp;
  let memberResult: boolean | Error;
  let membershipCalls: [string, string][];

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    memberResult = true;
    membershipCalls = [];
    api = await createNestHttpTestApp({
      imports: [HttpInfrastructureModule],
      controllers: [GuildMembershipProbeController],
      providers: [
        ActivityAuthGuard,
        GuildMemberGuard,
        {
          provide: DiscordService,
          useValue: {
            getDiscordUser: async (token: string) => ({ id: `user-${token}` }),
            isGuildMember: async (token: string, guildId: string) => {
              membershipCalls.push([token, guildId]);
              if (memberResult instanceof Error) throw memberResult;
              return memberResult;
            },
          },
        },
      ],
    });
  });

  afterEach(async () => {
    await api?.close();
  });

  it('admits a verified member of the requested community', async () => {
    const response = await fetch(
      `${api.origin}/api/guild-probe/community/community`,
      { headers: { authorization: 'Bearer token' } },
    );

    expect(membershipCalls).toEqual([['token', 'community']]);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ userId: 'user-token' });
  });

  it('rejects a nonmember, an unavailable Discord and a missing community', async () => {
    const cases = [
      {
        path: 'community/community',
        result: false,
        code: 403,
        body: { message: 'Not a community member' },
      },
      {
        path: 'community/community',
        result: new Error('offline'),
        code: 503,
        body: { message: 'Discord membership unavailable' },
      },
      {
        path: 'community',
        result: true,
        code: 400,
        body: { message: 'Invalid request' },
      },
    ];

    for (const { path, result, code, body } of cases) {
      memberResult = result;
      const response = await fetch(`${api.origin}/api/guild-probe/${path}`, {
        headers: { authorization: 'Bearer token' },
      });
      expect(response.status).toBe(code);
      expect(await response.json()).toEqual(body);
    }
    expect(membershipCalls).toEqual([
      ['token', 'community'],
      ['token', 'community'],
    ]);
  });
});
