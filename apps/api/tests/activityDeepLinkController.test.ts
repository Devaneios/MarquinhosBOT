import { beforeAll, describe, expect, it } from 'bun:test';

// Set in-memory db BEFORE any imports that load the db module — mirrors
// tests/activityDeepLink.test.ts so this suite doesn't touch the real marquinhos.db.
process.env.SQLITE_PATH = ':memory:';

let ActivityController: typeof import('../src/controllers/activity.controller').default;

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

beforeAll(async () => {
  ({ default: ActivityController } =
    await import('../src/controllers/activity.controller'));
});

describe('ActivityController deep-link intent', () => {
  it('records an intent and lets a matching claim consume it', async () => {
    const fakeService = {
      getDiscordUser: async () => ({ id: 'user-1' }),
    } as any;
    const controller = new ActivityController(fakeService);

    const recordRes = makeRes();
    controller.recordDeepLinkIntent(
      makeReq({ userId: 'user-1', guildId: 'guild-1', game: 'wordle' }),
      recordRes as any,
    );
    expect(recordRes.getStatus()).toBe(200);

    const claimRes = makeRes();
    await controller.claimDeepLinkIntent(
      makeReq({ accessToken: 'tok_abc', guildId: 'guild-1' }),
      claimRes as any,
    );

    expect(claimRes.getStatus()).toBe(200);
    expect(claimRes.getPayload()).toEqual({ data: { game: 'wordle' } });
  });

  it('claim returns a null game when there is no pending intent', async () => {
    const fakeService = {
      getDiscordUser: async () => ({ id: 'user-2' }),
    } as any;
    const controller = new ActivityController(fakeService);

    const claimRes = makeRes();
    await controller.claimDeepLinkIntent(
      makeReq({ accessToken: 'tok_abc', guildId: 'guild-2' }),
      claimRes as any,
    );

    expect(claimRes.getStatus()).toBe(200);
    expect(claimRes.getPayload()).toEqual({ data: { game: null } });
  });

  it('claim returns 401 for an invalid access token instead of leaking intent state', async () => {
    const fakeService = {
      getDiscordUser: async () => null,
    } as any;
    const controller = new ActivityController(fakeService);

    controller.recordDeepLinkIntent(
      makeReq({ userId: 'user-3', guildId: 'guild-3', game: 'wordle' }),
      makeRes() as any,
    );

    const claimRes = makeRes();
    await controller.claimDeepLinkIntent(
      makeReq({ accessToken: 'bad-token', guildId: 'guild-3' }),
      claimRes as any,
    );

    expect(claimRes.getStatus()).toBe(401);
  });

  it('claim derives the user from the resolved Discord identity, not the request body', async () => {
    const fakeService = {
      getDiscordUser: async () => ({ id: 'user-real' }),
    } as any;
    const controller = new ActivityController(fakeService);

    controller.recordDeepLinkIntent(
      makeReq({ userId: 'user-real', guildId: 'guild-4', game: 'wordle' }),
      makeRes() as any,
    );

    // Even though nothing in the claim body claims to be "user-real", the
    // controller resolves identity via accessToken -> getDiscordUser.
    const claimRes = makeRes();
    await controller.claimDeepLinkIntent(
      makeReq({ accessToken: 'tok_for_user_real', guildId: 'guild-4' }),
      claimRes as any,
    );

    expect(claimRes.getPayload()).toEqual({ data: { game: 'wordle' } });
  });
});
