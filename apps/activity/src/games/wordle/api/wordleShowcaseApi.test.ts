import { afterEach, expect, it } from 'bun:test';
import { getWordleShowcase, updateWordleShowcase } from './wordleShowcaseApi';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

it('loads and saves the ordered showcase with the player token', async () => {
  const requests: RequestInit[] = [];
  globalThis.fetch = Object.assign(
    async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      requests.push(init!);
      return new Response(JSON.stringify({ data: ['second', 'first'] }), {
        status: 200,
      });
    },
    { preconnect: originalFetch.preconnect },
  );
  expect(await getWordleShowcase('token')).toEqual(['second', 'first']);
  expect(await updateWordleShowcase('token', ['second', 'first'])).toEqual([
    'second',
    'first',
  ]);
  expect(requests[0].headers).toEqual({ Authorization: 'Bearer token' });
  expect(requests[1].method).toBe('PUT');
  expect(JSON.parse(String(requests[1].body))).toEqual({
    achievements: ['second', 'first'],
  });
});
