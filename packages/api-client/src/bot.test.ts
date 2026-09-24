import { afterEach, describe, expect, it, mock } from 'bun:test';
import { HttpClient, HttpError } from './bot';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function respondWith(...statuses: number[]) {
  const fetchMock = mock(async () => {
    const status = statuses.shift() ?? 200;
    return new Response(status === 200 ? '{}' : 'down', { status });
  });
  globalThis.fetch = Object.assign(fetchMock, {
    preconnect: originalFetch.preconnect,
  });
  return fetchMock;
}

describe('HttpClient retries', () => {
  // A retried POST can apply twice: a second word rotation, or a guess the
  // API already took coming back as "already guessed".
  it('does not repeat a POST on its own', async () => {
    const fetchMock = respondWith(503, 200);
    const client = new HttpClient({ baseURL: 'http://api.test', retries: 3 });

    await expect(
      client.request('/api/wordle/guess', { method: 'POST' }),
    ).rejects.toBeInstanceOf(HttpError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a POST that opts in', async () => {
    const fetchMock = respondWith(503, 200);
    const client = new HttpClient({ baseURL: 'http://api.test', retries: 3 });

    await client.request('/api/ai-chat/research', {
      method: 'POST',
      retries: 1,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries a GET', async () => {
    const fetchMock = respondWith(503, 200);
    const client = new HttpClient({ baseURL: 'http://api.test', retries: 3 });

    await client.request('/api/wordle/stats/g1', { method: 'GET' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
