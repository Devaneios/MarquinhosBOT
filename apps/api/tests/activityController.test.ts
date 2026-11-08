import {
  createdRoomSchema,
  wsSessionSchema,
} from '@marquinhos/contracts/http/routes/activity';
import { describe, expect, it } from 'bun:test';
import {
  DiscordGuildMembershipError,
  DiscordService,
} from 'integrations/discord/discord.service';
import { ACTIVITY_ROOM_QUERY } from 'modules/activity/activity.tokens';
import { roomKey } from 'modules/activity/room-key';
import {
  requestController,
  startNestControllerServer,
} from './helpers/nestControllerServer';
import { verifyWsSessionToken } from './helpers/wsSessionTokens';

type ControllerServer = Awaited<ReturnType<typeof startNestControllerServer>>;
type FakeDiscord = Pick<
  DiscordService,
  'exchangeActivityCode' | 'getDiscordUser' | 'isGuildMember'
>;

function defaultDiscord(): FakeDiscord {
  return {
    exchangeActivityCode: async () => ({
      access_token: 'tok_abc',
      token_type: 'Bearer',
      expires_in: 604800,
      scope: 'identify',
    }),
    getDiscordUser: async () => ({ id: 'user-1' }),
    isGuildMember: async () => true,
  } as unknown as FakeDiscord;
}

const discordWith = (overrides: Partial<FakeDiscord>) =>
  ({ ...defaultDiscord(), ...overrides }) as FakeDiscord;

async function withServer<T>(
  run: (server: ControllerServer) => Promise<T>,
  options: {
    discord?: FakeDiscord;
    queryRooms?: (...args: never[]) => Promise<unknown[]>;
  } = {},
): Promise<T> {
  const { ActivityModule } = await import('modules/activity/activity.module');
  const server = await startNestControllerServer(
    { imports: [ActivityModule] },
    (builder) =>
      builder
        .overrideProvider(DiscordService)
        .useValue(options.discord ?? defaultDiscord())
        .overrideProvider(ACTIVITY_ROOM_QUERY)
        .useValue(options.queryRooms ?? (async () => [])),
  );
  try {
    return await run(server);
  } finally {
    await server.close();
  }
}

function post(server: ControllerServer, path: string, body: unknown) {
  return requestController(server, `/activities${path}`, {
    method: 'POST',
    body,
    token: `Bearer ${server.activityToken}`,
  });
}

const wsBody = {
  accessToken: 'tok_abc',
  instanceId: 'inst-1',
  guildId: 'guild-1',
  mode: 'single',
  game: 'pong',
} as const;

const validTournamentBody = {
  accessToken: 'tok_abc',
  guildId: 'guild-1',
  name: 'Test tournament',
  format: 'round-robin',
  pool: 'classic-1v1',
  playerIds: ['user-1', 'user-2'],
} as const;

const validLeaderboardBody = {
  accessToken: 'tok_abc',
  guildId: 'guild-1',
  pool: 'classic-1v1',
} as const;

describe('ActivityController HTTP routes', () => {
  it('exchanges an OAuth code and returns the access token', async () => {
    await withServer(async (server) => {
      const response = await post(server, '/token', { code: 'auth-code-abc' });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: { access_token: 'tok_abc' } });
    });
  });

  it('returns the handler error when Discord token exchange fails', async () => {
    await withServer(
      async (server) => {
        const response = await post(server, '/token', { code: 'auth-code' });
        expect(response.status).toBe(500);
        expect(response.body).toEqual({ message: 'Unknown Error' });
      },
      {
        discord: {
          ...defaultDiscord(),
          exchangeActivityCode: async () => {
            throw new Error('discord down');
          },
        },
      },
    );
  });

  it('returns contract validation errors for a multi session without a roomId', async () => {
    await withServer(async (server) => {
      const response = await post(server, '/ws-session', {
        ...wsBody,
        mode: 'multi',
      });
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ message: 'Validation failed' });
    });
  });

  it('rejects an invalid ws-session body before calling Discord', async () => {
    let lookups = 0;
    await withServer(
      async (server) => {
        const response = await post(server, '/ws-session', {});
        expect(response.status).toBe(400);
        expect(lookups).toBe(0);
      },
      {
        discord: discordWith({
          getDiscordUser: async () => {
            lookups += 1;
            return { id: 'user-1' };
          },
        }),
      },
    );
  });

  it('keeps the 400 body with the Discord message when tournament membership is down', async () => {
    const outage = new DiscordGuildMembershipError(503);
    await withServer(
      async (server) => {
        const response = await post(
          server,
          '/pong/tournaments/create',
          validTournamentBody,
        );
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ message: outage.message });
      },
      {
        discord: discordWith({
          isGuildMember: async () => {
            throw outage;
          },
        }),
      },
    );
  });

  it('maps a membership outage on the Pong leaderboard to the legacy 500 body', async () => {
    await withServer(
      async (server) => {
        const response = await post(
          server,
          '/pong/leaderboard',
          validLeaderboardBody,
        );
        expect(response.status).toBe(500);
        expect(response.body).toEqual({ message: 'Unknown Error' });
      },
      {
        discord: discordWith({
          isGuildMember: async () => {
            throw new DiscordGuildMembershipError(503);
          },
        }),
      },
    );
  });

  it('mints a session token bound to the resolved user and instance', async () => {
    await withServer(async (server) => {
      const response = await post(server, '/ws-session', wsBody);
      expect(response.status).toBe(200);
      const data = wsSessionSchema.parse(
        (response.body as { data: unknown }).data,
      );
      expect(verifyWsSessionToken(data.token)).toEqual({
        userId: 'user-1',
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'single',
        game: 'pong',
      });
      expect(data.roomKey).toBe(
        roomKey({
          instanceId: 'inst-1',
          game: 'pong',
          mode: 'single',
          userId: 'user-1',
        }),
      );
    });
  });

  it('includes optional difficulty and Discord display name in the token', async () => {
    await withServer(
      async (server) => {
        const response = await post(server, '/ws-session', {
          ...wsBody,
          mode: 'multi',
          roomId: 'ROOM01',
          difficulty: 'easy',
        });
        const data = (response.body as { data: { token: string } }).data;
        expect(verifyWsSessionToken(data.token)).toMatchObject({
          userId: 'user-1',
          difficulty: 'easy',
          displayName: 'Marquinhos',
        });
      },
      {
        discord: {
          ...defaultDiscord(),
          getDiscordUser: async () => ({
            id: 'user-1',
            global_name: 'Marquinhos',
            username: 'fallback-name',
          }),
        },
      },
    );
  });

  it('returns 401 and the legacy message for an unresolved access token', async () => {
    await withServer(
      async (server) => {
        const response = await post(server, '/ws-session', {
          ...wsBody,
          mode: 'multi',
          roomId: 'ROOM01',
        });
        expect(response.status).toBe(401);
        expect(response.body).toEqual({ message: 'Invalid access token' });
      },
      { discord: { ...defaultDiscord(), getDiscordUser: async () => null } },
    );
  });

  it('returns 403 when the resolved user is not a member of the claimed guild', async () => {
    await withServer(
      async (server) => {
        const response = await post(server, '/ws-session', {
          ...wsBody,
          mode: 'multi',
          roomId: 'ROOM01',
        });
        expect(response.status).toBe(403);
        expect(response.body).toEqual({
          message: 'Not a member of the specified guild',
        });
      },
      { discord: { ...defaultDiscord(), isGuildMember: async () => false } },
    );
  });

  it('does not check guild membership for solo and local Pong sessions', async () => {
    let membershipChecks = 0;
    await withServer(
      async (server) => {
        for (const mode of ['single', 'local'] as const) {
          const response = await post(server, '/ws-session', {
            ...wsBody,
            mode,
          });
          expect(response.status).toBe(200);
        }
        expect(membershipChecks).toBe(0);
      },
      {
        discord: {
          ...defaultDiscord(),
          isGuildMember: async () => {
            membershipChecks += 1;
            return false;
          },
        },
      },
    );
  });

  it('requires guild membership for daily Wordle and marks it verified', async () => {
    await withServer(
      async (server) => {
        const denied = await post(server, '/ws-session', {
          accessToken: 'tok_abc',
          instanceId: 'inst-1',
          guildId: 'other-guild',
          mode: 'single',
          game: 'wordle',
        });
        expect(denied.status).toBe(403);

        const allowed = await post(server, '/ws-session', {
          accessToken: 'tok_abc',
          instanceId: 'inst-1',
          guildId: 'my-guild',
          mode: 'single',
          game: 'wordle',
        });
        const session = wsSessionSchema.parse(
          (allowed.body as { data: unknown }).data,
        );
        expect(verifyWsSessionToken(session.token)).toMatchObject({
          guildId: 'my-guild',
          guildMembershipVerified: true,
        });
      },
      {
        discord: {
          ...defaultDiscord(),
          isGuildMember: async (_token: string, guildId: string) =>
            guildId === 'my-guild',
        },
      },
    );
  });

  it('checks membership against the guild claimed in the request', async () => {
    const seen: { token: string; guildId: string }[] = [];
    await withServer(
      async (server) => {
        const response = await post(server, '/ws-session', {
          ...wsBody,
          mode: 'multi',
          roomId: 'ROOM01',
        });
        expect(response.status).toBe(200);
        expect(seen).toEqual([{ token: 'tok_abc', guildId: 'guild-1' }]);
      },
      {
        discord: {
          ...defaultDiscord(),
          isGuildMember: async (token: string, guildId: string) => {
            seen.push({ token, guildId });
            return true;
          },
        },
      },
    );
  });

  it('maps Discord lookup and guild lookup failures to the legacy 500 body', async () => {
    for (const discord of [
      {
        ...defaultDiscord(),
        getDiscordUser: async () => {
          throw new Error('discord down');
        },
      },
      {
        ...defaultDiscord(),
        isGuildMember: async () => {
          throw new Error('discord down');
        },
      },
    ]) {
      await withServer(
        async (server) => {
          const response = await post(server, '/ws-session', {
            ...wsBody,
            mode: 'multi',
            roomId: 'ROOM01',
          });
          expect(response.status).toBe(500);
          expect(response.body).toEqual({ message: 'Unknown Error' });
        },
        { discord },
      );
    }
  });

  it('includes ruleset, options, and roomId for a cards session', async () => {
    await withServer(async (server) => {
      const response = await post(server, '/ws-session', {
        ...wsBody,
        mode: 'multi',
        game: 'cards',
        ruleset: 'truco',
        options: { seed: 7 },
        roomId: 'ROOM01',
      });
      const data = (
        response.body as {
          data: { token: string; roomKey: string };
        }
      ).data;
      expect(verifyWsSessionToken(data.token)).toEqual({
        userId: 'user-1',
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'multi',
        game: 'cards',
        ruleset: 'truco',
        options: { seed: 7 },
        roomId: 'ROOM01',
      });
      expect(data.roomKey).toBe(
        roomKey({
          instanceId: 'inst-1',
          game: 'cards',
          mode: 'multi',
          userId: 'user-1',
          ruleset: 'truco',
          roomId: 'ROOM01',
        }),
      );
    });
  });

  it('lists valid room listings for the requested instance', async () => {
    const listing = {
      instanceId: 'inst-1',
      roomId: 'ROOM01',
      game: 'tic-tac-toe',
      hostUserId: 'u2',
      playerCount: 1,
      spectatorCount: 0,
      queueDepth: 0,
      queueEnabled: false,
      mode: 'multi',
    };
    await withServer(
      async (server) => {
        const response = await post(server, '/rooms/list', {
          accessToken: 'tok_abc',
          instanceId: 'inst-1',
          guildId: 'guild-1',
        });
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ data: [listing] });
      },
      {
        queryRooms: async (conditions: {
          name: string;
          instanceId: string;
          mode: string;
          locked: boolean;
        }) => {
          expect(conditions).toEqual({
            name: 'match',
            instanceId: 'inst-1',
            mode: 'multi',
            locked: false,
          });
          return [{ metadata: listing }];
        },
      },
    );
  });

  it('skips room listings without valid host metadata', async () => {
    const listing = {
      roomKey: 'multi:inst-1:ROOM01',
      instanceId: 'inst-1',
      roomId: 'ROOM01',
      game: 'tic-tac-toe',
      hostUserId: 'u2',
      playerCount: 1,
      spectatorCount: 0,
      queueDepth: 0,
      queueEnabled: false,
      mode: 'multi',
    };
    await withServer(
      async (server) => {
        const response = await post(server, '/rooms/list', {
          accessToken: 'tok_abc',
          instanceId: 'inst-1',
          guildId: 'guild-1',
        });
        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          data: [
            {
              instanceId: 'inst-1',
              roomId: 'ROOM01',
              game: 'tic-tac-toe',
              hostUserId: 'u2',
              playerCount: 1,
              spectatorCount: 0,
              queueDepth: 0,
              queueEnabled: false,
              mode: 'multi',
            },
          ],
        });
      },
      {
        queryRooms: async () => [
          { metadata: listing },
          { metadata: { ...listing, roomId: 'ROOM02', hostUserId: null } },
          { metadata: undefined },
        ],
      },
    );
  });

  it('returns the legacy 403 response when rooms are requested from another guild', async () => {
    await withServer(
      async (server) => {
        const response = await post(server, '/rooms/list', {
          accessToken: 'tok_abc',
          instanceId: 'inst-1',
          guildId: 'guild-1',
        });
        expect(response.status).toBe(403);
        expect(response.body).toEqual({
          message: 'Not a member of the specified guild',
        });
      },
      { discord: { ...defaultDiscord(), isGuildMember: async () => false } },
    );
  });

  it('maps Discord membership outages while listing rooms to 503', async () => {
    await withServer(
      async (server) => {
        const response = await post(server, '/rooms/list', {
          accessToken: 'tok_abc',
          instanceId: 'inst-1',
          guildId: 'guild-1',
        });
        expect(response.status).toBe(503);
        expect(response.body).toEqual({
          message: 'Discord membership service unavailable',
        });
      },
      {
        discord: {
          ...defaultDiscord(),
          isGuildMember: async () => {
            throw new DiscordGuildMembershipError(503);
          },
        },
      },
    );
  });

  it('mints a multi-mode room token and room key', async () => {
    await withServer(async (server) => {
      const response = await post(server, '/rooms', {
        accessToken: 'tok_abc',
        instanceId: 'inst-1',
        guildId: 'guild-1',
        game: 'tic-tac-toe',
        queueEnabled: true,
      });
      expect(response.status).toBe(200);
      const data = createdRoomSchema.parse(
        (response.body as { data: unknown }).data,
      );
      expect(data.roomId).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
      expect(verifyWsSessionToken(data.token)).toMatchObject({
        userId: 'user-1',
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'multi',
        game: 'tic-tac-toe',
        queueEnabled: true,
      });
      expect(data.roomKey).toBe(`inst-1:${data.roomId}:tic-tac-toe:multi`);
    });
  });

  it('refuses to create a room in a guild the user is not in', async () => {
    await withServer(
      async (server) => {
        const response = await post(server, '/rooms', {
          accessToken: 'tok_abc',
          instanceId: 'inst-1',
          guildId: 'guild-1',
          game: 'tic-tac-toe',
          queueEnabled: false,
        });
        expect(response.status).toBe(403);
        expect(response.body).toEqual({
          message: 'Not a member of the specified guild',
        });
      },
      { discord: { ...defaultDiscord(), isGuildMember: async () => false } },
    );
  });

  it('shares the 20 request bucket across different Activity routes', async () => {
    await withServer(async (server) => {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const response = await post(server, '/token', { code: 'auth-code' });
        expect(response.status).toBe(200);
      }

      const response = await post(server, '/ws-session', wsBody);
      expect(response.status).toBe(429);
      expect(response.body).toEqual({
        message: 'Too many requests, please try again later.',
      });
    });
  });
});
