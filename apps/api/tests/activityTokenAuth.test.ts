import { describe, expect, it, mock } from 'bun:test';
import { createActivityDiscordTokenVerifier } from 'middlewares/userAuth';
import type { DiscordService } from 'services/discord';

function makeResponse() {
  let statusCode: number | undefined;
  let payload: unknown;
  const response = {
    status(code: number) {
      statusCode = code;
      return response;
    },
    json(data: unknown) {
      payload = data;
      return response;
    },
    getStatus: () => statusCode,
    getPayload: () => payload,
  };
  return response;
}

describe('createActivityDiscordTokenVerifier', () => {
  it('validates a raw Activity access token and attaches its Discord user', async () => {
    const getDiscordUser = mock(async (token: string) =>
      token === 'activity-access-token' ? { id: 'user-1' } : null,
    );
    const verify = createActivityDiscordTokenVerifier({
      getDiscordUser,
    } as unknown as DiscordService);
    const request = {
      headers: { authorization: 'Bearer activity-access-token' },
    };
    const response = makeResponse();
    const next = mock(() => {});

    await verify(request as never, response as never, next);

    expect(getDiscordUser).toHaveBeenCalledWith('activity-access-token');
    expect(request).toEqual(
      expect.objectContaining({
        user: expect.objectContaining({ id: 'user-1' }),
      }),
    );
    expect(next).toHaveBeenCalledTimes(1);
    expect(response.getStatus()).toBeUndefined();
  });

  it('rejects an invalid raw Activity access token', async () => {
    const verify = createActivityDiscordTokenVerifier({
      getDiscordUser: async () => null,
    } as unknown as DiscordService);
    const response = makeResponse();

    await verify(
      { headers: { authorization: 'Bearer invalid-token' } } as never,
      response as never,
      mock(() => {}),
    );

    expect(response.getStatus()).toBe(401);
    expect(response.getPayload()).toEqual({ message: 'Unauthorized' });
  });
});
