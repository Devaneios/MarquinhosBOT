import { describe, expect, it, mock } from 'bun:test';

const calls: { request: unknown; options: unknown }[] = [];
mock.module('@marquinhos/api-client/bot', () => ({
  callContract: async (
    _client: unknown,
    contract: { path: string },
    request: unknown,
    options: unknown,
  ) => {
    calls.push({ request, options });
    return {
      data: contract.path.includes('/stats/') ? { wordDate: '2026-11-01' } : {},
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

describe('Wordle bot guess retries', () => {
  it('uses a unique request id and opts into safe HTTP retries', async () => {
    calls.length = 0;
    const service = MarquinhosApiService.getInstance();
    await service.submitWordleGuess('user', 'guild', 'termo');
    expect(calls).toHaveLength(2);
    const call = calls[1];
    expect(call?.request).toMatchObject({
      body: {
        userId: 'user',
        guildId: 'guild',
        guess: 'termo',
        date: '2026-11-01',
      },
    });
    const request = call?.request;
    if (
      !request ||
      typeof request !== 'object' ||
      !('body' in request) ||
      !request.body ||
      typeof request.body !== 'object' ||
      !('requestId' in request.body)
    )
      throw new Error('Missing request id');
    expect(request.body.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(call?.options).toEqual({ retries: 3 });
  });
});
