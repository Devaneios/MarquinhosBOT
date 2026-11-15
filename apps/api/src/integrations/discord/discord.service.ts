import { Injectable, Optional } from '@nestjs/common';
import axios from 'axios';
import { AppConfig } from 'config/app.config';
import { createHash } from 'node:crypto';
import { RedisService } from 'redis/redis.service';
import { URLSearchParams } from 'url';
import { z } from 'zod';
// URLSearchParams is available globally in Node.js >= 15 but we import for clarity

export interface DiscordUser {
  id: string;
  highestRole?: string;
  [key: string]: unknown;
}

const discordUserSchema: z.ZodType<DiscordUser> = z.looseObject({
  id: z.string(),
});

const discordGuildMemberSchema = z.object({ roles: z.array(z.string()) });

const discordRolesSchema = z.array(
  z.object({ id: z.string(), position: z.number(), name: z.string() }),
);

const DISCORD_TIMEOUT_MS = 10_000;
const USER_CACHE_TTL_MS = 15_000;
const MEMBERSHIP_CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 5_000;

export class DiscordGuildMembershipError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Discord guild membership check failed (status ${status})`);
    this.name = 'DiscordGuildMembershipError';
    this.status = status;
  }
}

const activityTokenExchangeResultSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
  scope: z.string(),
});

export type ActivityTokenExchangeResult = z.infer<
  typeof activityTokenExchangeResultSchema
>;

const oauthTokenResponseSchema = activityTokenExchangeResultSchema.extend({
  refresh_token: z.string(),
});

export function buildActivityTokenExchangeBody(
  code: string,
  clientId: string,
  clientSecret: string,
): URLSearchParams {
  return new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code,
  });
}

@Injectable()
export class DiscordService {
  constructor(
    private readonly config: AppConfig,
    @Optional() private readonly redis?: RedisService,
  ) {}

  private cacheSetBounded<T>(
    map: Map<string, T>,
    key: string,
    value: T,
    isExpired: (entry: T) => boolean,
  ): void {
    if (map.size >= CACHE_MAX_ENTRIES) {
      for (const [entryKey, entry] of map) {
        if (isExpired(entry)) map.delete(entryKey);
      }
      if (map.size >= CACHE_MAX_ENTRIES) map.clear();
    }
    map.set(key, value);
  }

  private userCacheKey(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private readonly userCache = new Map<
    string,
    { user: DiscordUser; expiresAt: number }
  >();

  getDiscordUser = async (token: string): Promise<DiscordUser | null> => {
    if (!this.config.isProduction && token === 'mock-access-token') {
      // Must match @discord/embedded-app-sdk's DiscordSDKMock, which always
      // resolves `user.id` to this literal client-side — any other value
      // here desyncs `identity.userId` from the userId the server embeds
      // in broadcasts, silently breaking every "is this me" comparison in
      // local dev (discovered via WordleRaceGame's per-player guess merge
      // never matching).
      return {
        id: 'mock_user_id',
        username: 'mock_user_username',
        discriminator: '1234',
        avatar: 'mock_user_avatar_hash',
      };
    }

    const key = this.userCacheKey(token);
    const now = Date.now();
    const localCached = this.userCache.get(key);
    if (localCached && localCached.expiresAt > now) {
      return localCached.user;
    }

    if (this.redis) {
      const redisCached = await this.redis.getCached(`discord:user:${key}`);
      if (redisCached) {
        const parsed = discordUserSchema.safeParse(JSON.parse(redisCached));
        if (parsed.success) {
          this.cacheSetBounded(
            this.userCache,
            key,
            { user: parsed.data, expiresAt: now + USER_CACHE_TTL_MS },
            (entry) => entry.expiresAt <= now,
          );
          return parsed.data;
        }
      }
    }

    const response = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(DISCORD_TIMEOUT_MS),
    });
    if (!response.ok) return null;

    const user = discordUserSchema.safeParse(await response.json());
    if (!user.success) return null;

    this.cacheSetBounded(
      this.userCache,
      key,
      { user: user.data, expiresAt: now + USER_CACHE_TTL_MS },
      (entry) => entry.expiresAt <= now,
    );
    if (this.redis) {
      await this.redis.setCached(
        `discord:user:${key}`,
        JSON.stringify(user.data),
        USER_CACHE_TTL_MS,
      );
    }
    return user.data;
  };

  // Confirmed memberships, keyed by a digest of the token so no token is
  // kept. One screen of the Activity makes several guild-scoped requests at
  // once, and Discord rate-limits this route tightly per user.
  private readonly confirmedMemberships = new Map<string, number>();

  private membershipKey(token: string, guildId: string): string {
    return createHash('sha256')
      .update(`${guildId}\u0000${token}`)
      .digest('hex');
  }

  isGuildMember = async (token: string, guildId: string): Promise<boolean> => {
    if (!this.config.isProduction && token === 'mock-access-token') {
      return guildId === '123456789012345678';
    }
    const key = this.membershipKey(token, guildId);
    const now = Date.now();
    const confirmedUntil = this.confirmedMemberships.get(key);
    if (confirmedUntil !== undefined && confirmedUntil > now) return true;

    if (this.redis) {
      const cached = await this.redis.getCached(`discord:member:${key}`);
      if (cached === '1') {
        this.cacheSetBounded(
          this.confirmedMemberships,
          key,
          now + MEMBERSHIP_CACHE_TTL_MS,
          (until) => until <= now,
        );
        return true;
      }
    }

    try {
      const response = await fetch(
        `https://discord.com/api/users/@me/guilds/${encodeURIComponent(guildId)}/member`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(DISCORD_TIMEOUT_MS),
        },
      );
      if (response.status === 404) return false;
      if (!response.ok) throw new DiscordGuildMembershipError(response.status);
      if (response.status !== 200) return false;
      this.cacheSetBounded(
        this.confirmedMemberships,
        key,
        now + MEMBERSHIP_CACHE_TTL_MS,
        (until) => until <= now,
      );
      if (this.redis) {
        await this.redis.setCached(
          `discord:member:${key}`,
          '1',
          MEMBERSHIP_CACHE_TTL_MS,
        );
      }
      return true;
    } catch (error) {
      if (error instanceof DiscordGuildMembershipError) throw error;
      throw new Error('Discord guild membership check failed', {
        cause: error,
      });
    }
  };

  getDiscordGuildUserHighestRole = async (token: string) => {
    const guildId = this.config.discordMainGuildId;
    const guildUserResponse = await fetch(
      `https://discord.com/api/users/@me/guilds/${encodeURIComponent(guildId)}/member`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(DISCORD_TIMEOUT_MS),
      },
    );

    if (!guildUserResponse.ok) {
      return '';
    }

    const guildUser = discordGuildMemberSchema.safeParse(
      await guildUserResponse.json(),
    );
    const memberRoles = guildUser.success ? guildUser.data.roles : [];
    if (memberRoles.length === 0) {
      return '';
    }

    const guildRolesResponse = await axios.get(
      `https://discord.com/api/guilds/${encodeURIComponent(guildId)}/roles`,
      {
        headers: {
          'User-Agent': 'DiscordBot',
          Authorization: `Bot ${this.config.discordBotToken}`,
        },
        timeout: DISCORD_TIMEOUT_MS,
      },
    );

    const guildRoles = discordRolesSchema.parse(guildRolesResponse.data);

    const highestRole = guildRoles
      .filter((role) => memberRoles.includes(role.id))
      .reduce<(typeof guildRoles)[number] | null>(
        (highest, role) =>
          !highest || role.position > highest.position ? role : highest,
        null,
      );

    return highestRole?.name || '';
  };

  requestToken = async (code: string) => {
    const body = new URLSearchParams({
      client_id: this.config.discordClientId ?? '',
      client_secret: this.config.discordClientSecret ?? '',
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.discordRedirectUri ?? '',
      scope: 'identify+guilds.members.read',
    });

    const response = await axios.post(
      'https://discord.com/api/oauth2/token',
      body,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        withCredentials: true,
        timeout: DISCORD_TIMEOUT_MS,
      },
    );

    return oauthTokenResponseSchema.parse(response.data);
  };

  exchangeActivityCode = async (
    code: string,
  ): Promise<ActivityTokenExchangeResult> => {
    const body = buildActivityTokenExchangeBody(
      code,
      this.config.discordClientId ?? '',
      this.config.discordClientSecret ?? '',
    );

    try {
      const response = await axios.post(
        'https://discord.com/api/oauth2/token',
        body,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: DISCORD_TIMEOUT_MS,
        },
      );

      return activityTokenExchangeResultSchema.parse(response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Discord activity token exchange failed (status ${error.response?.status}): ${JSON.stringify(error.response?.data)}`,
          { cause: error },
        );
      }
      throw error;
    }
  };

  refreshToken = async (refresh_token: string) => {
    const body = new URLSearchParams({
      client_id: this.config.discordClientId ?? '',
      client_secret: this.config.discordClientSecret ?? '',
      grant_type: 'refresh_token',
      refresh_token,
      redirect_uri: this.config.discordRedirectUri ?? '',
      scope: 'identify',
    });

    const response = await axios.post(
      'https://discord.com/api/oauth2/token',
      body,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        withCredentials: true,
        timeout: DISCORD_TIMEOUT_MS,
      },
    );

    if (response.status !== 200) {
      throw new Error('Invalid refresh token');
    }

    return oauthTokenResponseSchema.parse(response.data);
  };

  getAuthorizationUrl = (state?: string) => {
    let url = `https://discord.com/oauth2/authorize?response_type=code&client_id=${this.config.discordClientId}&scope=identify+guilds.members.read&redirect_uri=${encodeURIComponent(this.config.discordRedirectUri ?? '')}&prompt=none`;
    if (state) {
      url += `&state=${encodeURIComponent(state)}`;
    }
    return url;
  };
}
