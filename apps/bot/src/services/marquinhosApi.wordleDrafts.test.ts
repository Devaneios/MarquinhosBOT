import { describe, expect, it, mock } from 'bun:test';

process.env.MARQUINHOS_TOKEN = 'test-token';
process.env.MARQUINHOS_API_URL = 'http://localhost';
process.env.MARQUINHOS_API_KEY = 'test-key';
process.env.MARQUINHOS_CLIENT_ID = 'test-client';

const requests: unknown[] = [];
let resolveFirstResponse: ((value: unknown) => void) | undefined;
const firstResponse = new Promise((resolve) => {
  resolveFirstResponse = resolve;
});

mock.module('@marquinhos/api-client/bot', () => ({
  callContract: async (
    _client: unknown,
    _contract: unknown,
    request: unknown,
  ) => {
    requests.push(request);
    if (requests.length === 1) return firstResponse;
    return {
      data: {
        status: 'saved',
        draft: {
          date: '2026-10-29',
          rowIndex: 0,
          cells: [...'termo'],
          activeIndex: 4,
          revision: 4,
        },
      },
    };
  },
  HttpClient: class {
    interceptors = {
      request: { use: () => undefined },
      response: { use: () => undefined },
    };
  },
  HttpError: class extends Error {},
}));

const { MarquinhosApiService } = await import('./marquinhosApi');

describe('Wordle bot draft revision ordering', () => {
  it('does not retry a conflict with an autocomplete edit that is no longer current', async () => {
    requests.length = 0;
    let current = true;
    const api = MarquinhosApiService.getInstance();
    const write = api.writeWordleDraft(
      'user-1',
      'guild-1',
      {
        date: '2026-10-29',
        rowIndex: 0,
        cells: [...'termo'],
        activeIndex: 4,
      },
      () => current,
    );
    await Promise.resolve();

    current = false;
    resolveFirstResponse?.({
      data: {
        status: 'conflict',
        draft: {
          date: '2026-10-29',
          rowIndex: 0,
          cells: ['', '', '', '', ''],
          activeIndex: 0,
          revision: 3,
        },
      },
    });

    expect((await write).data.status).toBe('conflict');
    expect(requests).toHaveLength(1);
  });
});
