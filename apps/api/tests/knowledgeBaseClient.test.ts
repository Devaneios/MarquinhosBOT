import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { KnowledgeBaseClient } from 'services/aiChat/KnowledgeBaseClient';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.KNOWLEDGE_BASE_URL = 'http://devaneios-rag:8420';
  process.env.KNOWLEDGE_BASE_API_KEY = 'secret-token';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: async () => body,
  } as Response;
}

describe('KnowledgeBaseClient.search', () => {
  it('returns found chunks and context on a successful response', async () => {
    const fetchFn = mock(async () =>
      jsonResponse({
        found: true,
        context: 'contexto recuperado',
        chunks: [{ canal: 'kb-curada', autores: [], texto: 'trecho' }],
      }),
    );
    const client = new KnowledgeBaseClient(fetchFn as unknown as typeof fetch);

    const result = await client.search('quem é o fazendeiro?');

    expect(result).toEqual({
      found: true,
      context: 'contexto recuperado',
      chunks: [{ canal: 'kb-curada', autores: [], texto: 'trecho' }],
    });
  });

  it('POSTs to <url>/search with the query and a bearer auth header', async () => {
    const fetchFn = mock(async () =>
      jsonResponse({ found: false, context: '', chunks: [] }),
    );
    const client = new KnowledgeBaseClient(fetchFn as unknown as typeof fetch);

    await client.search('quem é o zegabr?');

    expect(fetchFn).toHaveBeenCalledWith(
      'http://devaneios-rag:8420/search',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer secret-token',
        }),
        body: JSON.stringify({ query: 'quem é o zegabr?' }),
      }),
    );
  });

  it('returns not-found without calling fetch when KNOWLEDGE_BASE_URL is unset', async () => {
    delete process.env.KNOWLEDGE_BASE_URL;
    const fetchFn = mock(async () => jsonResponse({}));
    const client = new KnowledgeBaseClient(fetchFn as unknown as typeof fetch);

    const result = await client.search('oi');

    expect(result).toEqual({ found: false, context: '', chunks: [] });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('returns not-found when the response is not ok', async () => {
    const fetchFn = mock(async () => jsonResponse({}, false));
    const client = new KnowledgeBaseClient(fetchFn as unknown as typeof fetch);

    const result = await client.search('oi');

    expect(result).toEqual({ found: false, context: '', chunks: [] });
  });

  it('returns not-found when fetch rejects (network error/timeout)', async () => {
    const fetchFn = mock(async () => {
      throw new Error('network down');
    });
    const client = new KnowledgeBaseClient(fetchFn as unknown as typeof fetch);

    const result = await client.search('oi');

    expect(result).toEqual({ found: false, context: '', chunks: [] });
  });

  it('returns not-found when the response body is malformed', async () => {
    const fetchFn = mock(async () => jsonResponse({ garbage: true }));
    const client = new KnowledgeBaseClient(fetchFn as unknown as typeof fetch);

    const result = await client.search('oi');

    expect(result).toEqual({ found: false, context: '', chunks: [] });
  });
});
