import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { checkToken } from 'middlewares/botAuth';

function makeReq(headers: Record<string, string>) {
  return { headers } as any;
}

function makeRes() {
  let capturedStatus: number | undefined;
  const res: any = {
    status(n: number) {
      capturedStatus = n;
      return { json: () => {} };
    },
    getStatus: () => capturedStatus,
  };
  return res;
}

describe('checkToken (botAuth middleware)', () => {
  const VALID_KEY = 'test-api-key-abc123';

  beforeEach(() => {
    process.env.MARQUINHOS_API_KEY = VALID_KEY;
  });

  afterEach(() => {
    delete process.env.MARQUINHOS_API_KEY;
  });

  it('calls next() when Authorization header has valid Bearer token', () => {
    const req = makeReq({ authorization: `Bearer ${VALID_KEY}` });
    const res = makeRes();
    let nextCalled = false;
    checkToken(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
  });

  it('returns 401 when token does not match', () => {
    const req = makeReq({ authorization: 'Bearer wrong-key' });
    const res = makeRes();
    checkToken(req, res, () => {});
    expect(res.getStatus()).toBe(401);
  });

  it('returns 401 when Authorization header is missing', () => {
    const req = makeReq({});
    const res = makeRes();
    checkToken(req, res, () => {});
    expect(res.getStatus()).toBe(401);
  });
});
