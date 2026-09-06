import { describe, expect, it } from 'bun:test';
import { matchMaker } from 'colyseus';
import ActivityController from 'controllers/activity.controller';
import { roomKey } from 'services/activity/roomKey';
import { verifyWsSessionToken } from 'services/activity/wsSessionToken';
import type { DiscordService } from 'services/discord';

function makeReq(body: Record<string, unknown>) {
  return { body } as any;
}

function makeRes() {
  let statusCode: number | undefined;
  let payload: unknown;
  const res = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(data: unknown) {
      payload = data;
      return res;
    },
    getStatus: () => statusCode,
    getPayload: () => payload,
  };
  return res;
}

describe('ActivityController.exchangeToken', () => {
  it('returns 200 with the access token from DiscordService', async () => {
    const fakeService = {
      exchangeActivityCode: async () => ({
        access_token: 'tok_abc',
        token_type: 'Bearer',
        expires_in: 604800,
        scope: 'identify',
      }),
    } as unknown as DiscordService;
    const controller = new ActivityController(fakeService);

    const req = makeReq({ code: 'auth-code-abc' });
    const res = makeRes();

    await controller.exchangeToken(req, res as any);

    expect(res.getStatus()).toBe(200);
    expect(res.getPayload()).toEqual({ data: { access_token: 'tok_abc' } });
  });

  it('returns 500 when DiscordService throws', async () => {
    const fakeService = {
      exchangeActivityCode: async () => {
        throw new Error('discord down');
      },
    } as unknown as DiscordService;
    const controller = new ActivityController(fakeService);

    const req = makeReq({ code: 'auth-code-abc' });
    const res = makeRes();

    await controller.exchangeToken(req, res as any);

    expect(res.getStatus()).toBe(500);
  });
});

describe('ActivityController.getWsSessionToken', () => {
  it('mints a WS session token bound to the resolved Discord user and instance', async () => {
    const fakeService = {
      getDiscordUser: async () => ({ id: 'user-1' }),
      isGuildMember: async () => true,
    } as unknown as DiscordService;
    const controller = new ActivityController(fakeService);

    const req = makeReq({
      accessToken: 'tok_abc',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'single',
      game: 'pong',
    });
    const res = makeRes();

    await controller.getWsSessionToken(req, res as any);

    expect(res.getStatus()).toBe(200);
    const payload = res.getPayload() as {
      data: { token: string; roomKey: string };
    };
    expect(verifyWsSessionToken(payload.data.token)).toEqual({
      userId: 'user-1',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'single',
      game: 'pong',
    });
    expect(payload.data.roomKey).toBe(
      roomKey({
        instanceId: 'inst-1',
        game: 'pong',
        mode: 'single',
        userId: 'user-1',
      }),
    );
  });

  it('includes an optional difficulty in the minted token', async () => {
    const fakeService = {
      getDiscordUser: async () => ({ id: 'user-1' }),
      isGuildMember: async () => true,
    } as unknown as DiscordService;
    const controller = new ActivityController(fakeService);

    const req = makeReq({
      accessToken: 'tok_abc',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'single',
      game: 'pong',
      difficulty: 'easy',
    });
    const res = makeRes();

    await controller.getWsSessionToken(req, res as any);

    const payload = res.getPayload() as { data: { token: string } };
    expect(verifyWsSessionToken(payload.data.token)).toEqual({
      userId: 'user-1',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'single',
      game: 'pong',
      difficulty: 'easy',
    });
  });

  it('includes the Discord display name in the minted token', async () => {
    const fakeService = {
      getDiscordUser: async () => ({
        id: 'user-1',
        global_name: 'Marquinhos',
        username: 'fallback-name',
      }),
      isGuildMember: async () => true,
    } as unknown as DiscordService;
    const controller = new ActivityController(fakeService);
    const req = makeReq({
      accessToken: 'tok_abc',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'multi',
      game: 'pong',
    });
    const res = makeRes();

    await controller.getWsSessionToken(req, res as any);

    const payload = res.getPayload() as { data: { token: string } };
    expect(verifyWsSessionToken(payload.data.token)?.displayName).toBe(
      'Marquinhos',
    );
  });

  it('returns 401 when the access token does not resolve to a Discord user', async () => {
    const fakeService = {
      getDiscordUser: async () => ({}),
      isGuildMember: async () => true,
    } as unknown as DiscordService;
    const controller = new ActivityController(fakeService);

    const req = makeReq({
      accessToken: 'bad-token',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'multi',
    });
    const res = makeRes();

    await controller.getWsSessionToken(req, res as any);

    expect(res.getStatus()).toBe(401);
  });

  it('returns 403 when the resolved user is not a member of the claimed guild', async () => {
    const fakeService = {
      getDiscordUser: async () => ({ id: 'user-1' }),
      isGuildMember: async () => false,
    } as unknown as DiscordService;
    const controller = new ActivityController(fakeService);

    const req = makeReq({
      accessToken: 'tok_abc',
      instanceId: 'inst-1',
      guildId: 'guild-not-mine',
      mode: 'multi',
    });
    const res = makeRes();

    await controller.getWsSessionToken(req, res as any);

    expect(res.getStatus()).toBe(403);
  });

  it('does not require guild membership for a solo (vs. bot) session', async () => {
    let called = false;
    const fakeService = {
      getDiscordUser: async () => ({ id: 'user-1' }),
      isGuildMember: async () => {
        called = true;
        return false; // even a "no" must not block a mode that never reads guildId
      },
    } as unknown as DiscordService;
    const controller = new ActivityController(fakeService);

    const req = makeReq({
      accessToken: 'tok_abc',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'single',
      game: 'pong',
    });
    const res = makeRes();

    await controller.getWsSessionToken(req, res as any);

    expect(called).toBe(false);
    expect(res.getStatus()).toBe(200);
  });

  it('does not require guild membership for a local hot-seat session', async () => {
    let called = false;
    const fakeService = {
      getDiscordUser: async () => ({ id: 'user-1' }),
      isGuildMember: async () => {
        called = true;
        return false;
      },
    } as unknown as DiscordService;
    const controller = new ActivityController(fakeService);

    const req = makeReq({
      accessToken: 'tok_abc',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'local',
      game: 'pong',
    });
    const res = makeRes();

    await controller.getWsSessionToken(req, res as any);

    expect(called).toBe(false);
    expect(res.getStatus()).toBe(200);
  });

  it('checks membership against the guild claimed in the request, for the resolved user', async () => {
    const seen: { token: string; guildId: string }[] = [];
    const fakeService = {
      getDiscordUser: async () => ({ id: 'user-1' }),
      isGuildMember: async (token: string, guildId: string) => {
        seen.push({ token, guildId });
        return true;
      },
    } as unknown as DiscordService;
    const controller = new ActivityController(fakeService);

    const req = makeReq({
      accessToken: 'tok_abc',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'multi',
    });
    const res = makeRes();

    await controller.getWsSessionToken(req, res as any);

    expect(seen).toEqual([{ token: 'tok_abc', guildId: 'guild-1' }]);
  });

  it('returns 500 when DiscordService throws', async () => {
    const fakeService = {
      getDiscordUser: async () => {
        throw new Error('discord down');
      },
      isGuildMember: async () => true,
    } as unknown as DiscordService;
    const controller = new ActivityController(fakeService);

    const req = makeReq({
      accessToken: 'tok_abc',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'multi',
    });
    const res = makeRes();

    await controller.getWsSessionToken(req, res as any);

    expect(res.getStatus()).toBe(500);
  });

  it('includes ruleset and options in the minted token for a cards session', async () => {
    const fakeService = {
      getDiscordUser: async () => ({ id: 'user-1' }),
      isGuildMember: async () => true,
    } as unknown as DiscordService;
    const controller = new ActivityController(fakeService);

    const req = makeReq({
      accessToken: 'tok_abc',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'multi',
      game: 'cards',
      ruleset: 'truco',
      options: { seed: 7 },
      roomId: 'ROOM01',
    });
    const res = makeRes();

    await controller.getWsSessionToken(req, res as any);

    const payload = res.getPayload() as {
      data: { token: string; roomKey: string };
    };
    expect(verifyWsSessionToken(payload.data.token)).toEqual({
      userId: 'user-1',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'multi',
      game: 'cards',
      ruleset: 'truco',
      options: { seed: 7 },
      roomId: 'ROOM01',
    });
    expect(payload.data.roomKey).toBe(
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

  it('returns 500 when the guild membership check throws', async () => {
    const fakeService = {
      getDiscordUser: async () => ({ id: 'user-1' }),
      isGuildMember: async () => {
        throw new Error('discord down');
      },
    } as unknown as DiscordService;
    const controller = new ActivityController(fakeService);

    const req = makeReq({
      accessToken: 'tok_abc',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'multi',
    });
    const res = makeRes();

    await controller.getWsSessionToken(req, res as any);

    expect(res.getStatus()).toBe(500);
  });
});

describe('ActivityController.listRooms', () => {
  it('lists match rooms for this instance, mapped from room metadata', async () => {
    const fakeService = {
      getDiscordUser: async () => ({ id: 'user-1' }),
      isGuildMember: async () => true,
    } as unknown as DiscordService;
    const queryRooms = (async (conditions: Record<string, unknown>) => {
      expect(conditions).toEqual({
        name: 'match',
        instanceId: 'inst-1',
        mode: 'multi',
        locked: false,
      });
      return [
        {
          metadata: {
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
        },
      ];
    }) as unknown as typeof matchMaker.query;
    const controller = new ActivityController(fakeService, queryRooms);

    const req = makeReq({
      accessToken: 'token',
      instanceId: 'inst-1',
      guildId: 'guild-1',
    });
    const res = makeRes();

    await controller.listRooms(req, res as any);

    expect(res.getStatus()).toBe(200);
    expect(res.getPayload()).toEqual({
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
  });

  it('rejects with 403 when the user is not a guild member', async () => {
    const fakeService = {
      getDiscordUser: async () => ({ id: 'user-1' }),
      isGuildMember: async () => false,
    } as unknown as DiscordService;
    const controller = new ActivityController(fakeService, async () => []);

    const req = makeReq({
      accessToken: 'token',
      instanceId: 'inst-1',
      guildId: 'guild-1',
    });
    const res = makeRes();

    await controller.listRooms(req, res as any);

    expect(res.getStatus()).toBe(403);
  });
});

describe('ActivityController.createRoom', () => {
  it('mints a roomId and a multi-mode token/roomKey', async () => {
    const fakeService = {
      getDiscordUser: async () => ({ id: 'user-1' }),
    } as unknown as DiscordService;
    const controller = new ActivityController(fakeService);

    const req = makeReq({
      accessToken: 'token',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      game: 'tic-tac-toe',
      queueEnabled: true,
    });
    const res = makeRes();

    await controller.createRoom(req, res as any);

    expect(res.getStatus()).toBe(200);
    const payload = res.getPayload() as {
      data: { roomId: string; token: string; roomKey: string };
    };
    expect(typeof payload.data.roomId).toBe('string');
    expect(payload.data.roomId.length).toBeGreaterThan(0);
    expect(typeof payload.data.token).toBe('string');
    expect(payload.data.roomKey).toBe(
      `inst-1:${payload.data.roomId}:tic-tac-toe:multi`,
    );
  });
});
