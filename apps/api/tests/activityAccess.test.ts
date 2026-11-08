import { HttpException } from '@nestjs/common';
import { describe, expect, it } from 'bun:test';
import {
  DiscordGuildMembershipError,
  DiscordService,
  type DiscordUser,
} from 'integrations/discord/discord.service';
import {
  ActivityAccessService,
  discordDisplayName,
} from 'modules/activity/activity-access.service';

type FakeDiscord = Pick<DiscordService, 'getDiscordUser' | 'isGuildMember'>;

const discordWith = (overrides: Partial<FakeDiscord> = {}): FakeDiscord => ({
  getDiscordUser: async () => ({ id: 'user-1' }),
  isGuildMember: async () => true,
  ...overrides,
});

describe('ActivityAccessService', () => {
  it('rejects a null user with 401', async () => {
    const service = new ActivityAccessService(
      discordWith({ getDiscordUser: async () => null }) as DiscordService,
    );

    try {
      await service.authenticate('access-token');
      throw new Error('expected authenticate to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(401);
      expect((error as HttpException).getResponse()).toEqual({
        message: 'Invalid access token',
      });
    }
  });

  it('rejects an empty user id with 401', async () => {
    const service = new ActivityAccessService(
      discordWith({
        getDiscordUser: async () => ({ id: '' }),
      }) as DiscordService,
    );

    try {
      await service.authenticate('access-token');
      throw new Error('expected authenticate to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(401);
      expect((error as HttpException).getResponse()).toEqual({
        message: 'Invalid access token',
      });
    }
  });

  it('rejects a non-member with 403', async () => {
    const service = new ActivityAccessService(
      discordWith({ isGuildMember: async () => false }) as DiscordService,
    );

    try {
      await service.authenticateMember('access-token', 'guild-1');
      throw new Error('expected authenticateMember to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(403);
      expect((error as HttpException).getResponse()).toEqual({
        message: 'Not a member of the specified guild',
      });
    }
  });

  it('rethrows the same Discord membership outage', async () => {
    const outage = new DiscordGuildMembershipError(503);
    const service = new ActivityAccessService(
      discordWith({
        isGuildMember: async () => {
          throw outage;
        },
      }) as DiscordService,
    );

    await expect(
      service.authenticateMember('access-token', 'guild-1'),
    ).rejects.toBe(outage);
  });
});

describe('discordDisplayName', () => {
  it('prefers a non-empty global name', () => {
    expect(
      discordDisplayName({
        id: 'user-1',
        global_name: 'Global',
        username: 'user',
      }),
    ).toBe('Global');
  });

  it('falls back to a non-empty username', () => {
    expect(
      discordDisplayName({ id: 'user-1', global_name: '', username: 'user' }),
    ).toBe('user');
  });

  it('returns undefined when no display name exists', () => {
    expect(
      discordDisplayName({ id: 'x' } satisfies DiscordUser),
    ).toBeUndefined();
  });
});
