import { afterEach, describe, expect, it } from 'bun:test';
import { errorMessage, HttpError, isAuthError, postJson } from './http';

describe('postJson', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns the data field on a successful response', async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ data: { token: 'abc' } }), {
        status: 200,
      })) as unknown as typeof fetch;

    const result = await postJson<{ token: string }>('https://api.test/x', {
      foo: 'bar',
    });

    expect(result).toEqual({ token: 'abc' });
  });

  it('throws an HttpError carrying the response status on a non-ok response', async () => {
    globalThis.fetch = (async () =>
      new Response('', { status: 401 })) as unknown as typeof fetch;

    await expect(postJson('https://api.test/x', {})).rejects.toMatchObject({
      status: 401,
    });
  });
});

describe('isAuthError', () => {
  it('is true for a 401 HttpError', () => {
    expect(isAuthError(new HttpError(401, 'https://api.test/x'))).toBe(true);
  });

  it('is true for a 403 HttpError', () => {
    expect(isAuthError(new HttpError(403, 'https://api.test/x'))).toBe(true);
  });

  it('is false for a 500 HttpError', () => {
    expect(isAuthError(new HttpError(500, 'https://api.test/x'))).toBe(false);
  });

  it('is false for a plain Error', () => {
    expect(isAuthError(new Error('network down'))).toBe(false);
  });
});

describe('errorMessage', () => {
  it('returns the message of a plain Error', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
  });

  it('returns the message of an HttpError', () => {
    expect(errorMessage(new HttpError(500, 'https://api.test/x'))).toBe(
      'Request to https://api.test/x failed with 500',
    );
  });

  it('normalizes a raw {code, message} RPC-rejection shape', () => {
    expect(errorMessage({ code: 4006, message: 'Already authing' })).toBe(
      'Already authing',
    );
  });

  it('falls back to a generic message for an unrecognized shape', () => {
    expect(errorMessage('nope')).toBe('Unknown error');
  });
});
