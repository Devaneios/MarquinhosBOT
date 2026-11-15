import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { DiscordService } from 'integrations/discord/discord.service';
import { LastfmService } from 'integrations/lastfm/lastfm.service';
import { AuthModule } from 'modules/auth/auth.module';
import { UserService } from 'modules/user/user.service';
import { startNestContractServer } from '../helpers/contractServer';

const { callContract } = await import('@marquinhos/api-client/bot');
const auth = await import('@marquinhos/contracts/http/routes/auth');
const { encryptToken } = await import('../../src/common/crypto');

const tokens = {
  access_token: 'discord-access',
  refresh_token: 'discord-refresh',
  token_type: 'Bearer',
  expires_in: 3600,
  scope: 'identify',
};

const fakeDiscord = {
  requestToken: async () => tokens,
  refreshToken: async () => tokens,
  getDiscordUser: async () => ({ id: 'u1' }),
  getAuthorizationUrl: (state?: string) =>
    `https://discord.test/oauth?state=${state ?? ''}`,
} as unknown as DiscordService;

const fakeLastfm = {
  getAuthorizationUrl: () => 'https://last.fm.test/auth',
} as unknown as LastfmService;

const fakeUsers = {
  exists: async () => ({ id: 'u1' }),
  create: async () => undefined,
} as unknown as UserService;

let server: Awaited<ReturnType<typeof startNestContractServer>>;

beforeAll(async () => {
  server = await startNestContractServer({ imports: [AuthModule] }, (builder) =>
    builder
      .overrideProvider(DiscordService)
      .useValue(fakeDiscord)
      .overrideProvider(LastfmService)
      .useValue(fakeLastfm)
      .overrideProvider(UserService)
      .useValue(fakeUsers),
  );
});

afterAll(() => server.close());

describe('auth contracts', () => {
  it('serves the discord and last.fm login urls with signed state', async () => {
    const discord = await callContract(server.http, auth.discordLoginUrl, {
      query: { state: 'abc' },
    });
    const lastfm = await callContract(server.http, auth.lastfmLoginUrl, {});

    const signedState = new URL(discord.data).searchParams.get('state');
    expect(signedState).toBeTruthy();
    expect(signedState).not.toBe('abc');
    expect(lastfm.data).toBe('https://last.fm.test/auth');
  });

  it('logs in with an oauth code and valid signed state', async () => {
    const discord = await callContract(server.http, auth.discordLoginUrl, {
      query: { state: 'abc' },
    });
    const state = new URL(discord.data).searchParams.get('state')!;
    const response = await callContract(server.http, auth.login, {
      query: { code: 'oauth-code', state },
    });

    expect(response).toEqual({ message: 'Authenticated successfully' });
  });

  it('supports existing clients that do not return OAuth state', async () => {
    const response = await fetch(
      `${server.origin}/api/auth/login?code=oauth-code`,
    );
    expect(response.status).toBe(200);
  });

  it('rejects tampered oauth state on login', async () => {
    const res = await fetch(
      `${server.origin}/api/auth/login?code=oauth-code&state=forged.state`,
    );
    expect(res.status).toBe(400);
  });

  it('refreshes a token from the Refresh-Token header', async () => {
    const response = await callContract(
      server.http,
      auth.refreshToken,
      {},
      {
        headers: {
          'Refresh-Token':
            encryptToken('discord-refresh', undefined, {
              secret: process.env.MARQUINHOS_SECRET_KEY,
              salt: process.env.MARQUINHOS_CRYPTO_SALT,
            }) ?? '',
        },
      },
    );

    expect(response).toEqual({ message: 'Token refreshed' });
  });
});
