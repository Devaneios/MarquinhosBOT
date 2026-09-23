import { describe, expect, it } from 'bun:test';
import AuthController from 'controllers/auth.controller';

// Node lowercases incoming header names; Express's req.get() looks them up
// case-insensitively, which this fake mirrors.
function makeReq(headers: Record<string, string>) {
  return {
    headers,
    get: (name: string) => headers[name.toLowerCase()],
  } as any;
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

describe('AuthController.refreshToken', () => {
  it('reads the Refresh-Token header regardless of case', async () => {
    const res = makeRes();
    await new AuthController().refreshToken(
      makeReq({ 'refresh-token': 'not-a-real-token' }),
      res as any,
    );
    expect(res.getPayload()).not.toEqual({
      message: 'Refresh token not found',
    });
  });

  it('rejects a request without the header', async () => {
    const res = makeRes();
    await new AuthController().refreshToken(makeReq({}), res as any);
    expect(res.getStatus()).toBe(400);
    expect(res.getPayload()).toEqual({ message: 'Refresh token not found' });
  });
});
