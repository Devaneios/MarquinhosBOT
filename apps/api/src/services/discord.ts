import axios from 'axios';
import { URLSearchParams } from 'url';
// URLSearchParams is available globally in Node.js >= 15 but we import for clarity

export interface DiscordUser {
  id: string;
  highestRole?: string;
  [key: string]: unknown;
}

interface DiscordGuildMember {
  roles: string[];
  [key: string]: unknown;
}

export class DiscordGuildMembershipError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Discord guild membership check failed (status ${status})`);
    this.name = 'DiscordGuildMembershipError';
    this.status = status;
  }
}

export interface ActivityTokenExchangeResult {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export function buildActivityTokenExchangeBody(code: string): URLSearchParams {
  return new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID ?? '',
    client_secret: process.env.DISCORD_CLIENT_SECRET ?? '',
    grant_type: 'authorization_code',
    code,
  });
}

export class DiscordService {
  getDiscordUser = async (token: string): Promise<DiscordUser> => {
    if (
      process.env.NODE_ENV !== 'production' &&
      token === 'mock-access-token'
    ) {
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
      } as DiscordUser;
    }

    const response = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = (await response.json()) as DiscordUser;

    return data;
  };

  isGuildMember = async (token: string, guildId: string): Promise<boolean> => {
    try {
      const response = await fetch(
        `https://discord.com/api/users/@me/guilds/${guildId}/member`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (response.status === 404) return false;
      if (!response.ok) throw new DiscordGuildMembershipError(response.status);
      return response.status === 200;
    } catch (error) {
      if (error instanceof DiscordGuildMembershipError) throw error;
      throw new Error('Discord guild membership check failed', {
        cause: error,
      });
    }
  };

  getDiscordGuildUserHighestRole = async (token: string) => {
    const guildUserResponse = await fetch(
      'https://discord.com/api/users/@me/guilds/305861924648779779/member',
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const guildUser = (await guildUserResponse.json()) as DiscordGuildMember;

    const guildRolesResponse = await axios.get(
      `https://discord.com/api/guilds/305861924648779779/roles`,
      {
        headers: {
          'User-Agent': 'DiscordBot',
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        },
      },
    );

    const guildRoles = guildRolesResponse?.data as Array<{
      id: string;
      position: number;
      name: string;
    }>;

    const highestRole = guildRoles
      .filter((role) => guildUser?.roles.includes(role.id))
      .reduce<(typeof guildRoles)[number] | null>(
        (highest, role) =>
          !highest || role.position > highest.position ? role : highest,
        null,
      );

    return highestRole?.name || '';
  };

  requestToken = async (code: string) => {
    const body = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID ?? '',
      client_secret: process.env.DISCORD_CLIENT_SECRET ?? '',
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.DISCORD_REDIRECT_URI ?? '',
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
      },
    );

    return response.data;
  };

  exchangeActivityCode = async (
    code: string,
  ): Promise<ActivityTokenExchangeResult> => {
    const body = buildActivityTokenExchangeBody(code);

    try {
      const response = await axios.post(
        'https://discord.com/api/oauth2/token',
        body,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      return response.data;
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
      client_id: process.env.DISCORD_CLIENT_ID ?? '',
      client_secret: process.env.DISCORD_CLIENT_SECRET ?? '',
      grant_type: 'refresh_token',
      refresh_token,
      redirect_uri: process.env.DISCORD_REDIRECT_URI ?? '',
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
      },
    );

    if (response.status !== 200) {
      throw new Error('Invalid refresh token');
    }

    return response.data;
  };

  getAuthorizationUrl = (state?: string) => {
    let url = `https://discord.com/oauth2/authorize?response_type=code&client_id=${process.env.DISCORD_CLIENT_ID}&scope=identify+guilds.members.read&redirect_uri=${encodeURIComponent(process.env.DISCORD_REDIRECT_URI ?? '')}&prompt=none`;
    if (state) {
      url += `&state=${encodeURIComponent(state)}`;
    }
    return url;
  };
}
