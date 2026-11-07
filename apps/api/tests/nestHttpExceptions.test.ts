import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { startApi } from './helpers/startApi';

describe('Nest HTTP body parser errors', () => {
  let api: Awaited<ReturnType<typeof startApi>>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    api = await startApi({ silent: true });
  }, 30_000);

  afterAll(async () => {
    await api?.close();
  });

  test('returns the approved 400 response for malformed JSON', async () => {
    const response = await fetch(`${api.origin}/api/activities/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: 'Invalid JSON body' });
  });

  test('returns the approved 413 response for an oversized JSON body', async () => {
    const response = await fetch(`${api.origin}/api/activities/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: 'x'.repeat(150_000) }),
    });

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      message: 'Request body too large',
    });
  });
});
