import { ServerError } from '@colyseus/sdk';
import { fetchContract, HttpError } from '@marquinhos/api-client/browser';
import { defineContract } from '@marquinhos/contracts/http/contract';
import { afterEach, describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { errorMessage, isAuthError } from './http';

const probe = defineContract({
  method: 'POST',
  path: '/api/probe',
  body: z.object({ foo: z.string() }),
  response: z.object({ data: z.object({ token: z.string() }) }),
});

describe('fetchContract', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('parses a successful response with the contract', async () => {
    let requestUrl = '';
    globalThis.fetch = (async (input: unknown) => {
      requestUrl = String(input);
      return new Response(JSON.stringify({ data: { token: 'abc' } }), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const result = await fetchContract('https://api.test/api', probe, {
      body: { foo: 'bar' },
    });

    expect(result).toEqual({ data: { token: 'abc' } });
    expect(requestUrl).toBe('https://api.test/api/probe');
  });

  it('rejects a response that does not match the contract', async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ data: { token: 42 } }), {
        status: 200,
      })) as unknown as typeof fetch;

    await expect(
      fetchContract('https://api.test/api', probe, { body: { foo: 'bar' } }),
    ).rejects.toThrow('Invalid response from https://api.test/api/probe');
  });

  it('throws an HttpError carrying the response status on a non-ok response', async () => {
    globalThis.fetch = (async () =>
      new Response('', { status: 401 })) as unknown as typeof fetch;

    await expect(
      fetchContract('https://api.test/api', probe, { body: { foo: 'bar' } }),
    ).rejects.toMatchObject({ status: 401 });
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

  // A rejected Colyseus room.onAuth (invalid/expired token, roomKey
  // mismatch) surfaces as a ServerError from the join call, not an
  // HttpError — the only reason our onAuth ever throws is an auth failure,
  // so any ServerError here is treated as one.
  it('is true for a Colyseus ServerError (rejected onAuth)', () => {
    expect(
      isAuthError(new ServerError(4002, 'Invalid or expired session token')),
    ).toBe(true);
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
