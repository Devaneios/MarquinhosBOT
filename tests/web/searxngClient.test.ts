import { describe, expect, it, mock } from 'bun:test';
import { SearxngClient, SearxngError } from 'services/aiChat/web/SearxngClient';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const twoResults = {
  query: 'recife',
  results: [
    {
      url: 'https://pt.wikipedia.org/wiki/Recife',
      title: 'Recife',
      content: 'Capital de Pernambuco',
      engines: ['wikipedia', 'google'],
      score: 2.5,
      publishedDate: '2024-01-02T00:00:00',
    },
    {
      url: 'https://recife.pe.gov.br/',
      title: 'Prefeitura do Recife',
      content: 'Portal oficial',
      engines: ['google'],
      score: 0.5,
      publishedDate: null,
    },
  ],
};

describe('SearxngClient.search', () => {
  it('calls the configured instance with format=json and the encoded query', async () => {
    const fetchFn = mock(async (_url: URL | string, _init?: RequestInit) =>
      jsonResponse(twoResults),
    );
    const client = new SearxngClient({
      fetchFn,
      baseUrl: 'https://searx.example.com',
    });

    await client.search('recife & olinda');

    const requested = String(fetchFn.mock.calls[0]?.[0]);
    expect(requested).toStartWith('https://searx.example.com/search?');
    expect(requested).toContain('format=json');
    expect(requested).toContain('q=recife+%26+olinda');
  });

  it('maps results into hits with url, title, snippet, engines and score', async () => {
    const fetchFn = mock(async (_url: URL | string, _init?: RequestInit) =>
      jsonResponse(twoResults),
    );
    const client = new SearxngClient({ fetchFn });

    const hits = await client.search('recife');

    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({
      url: 'https://pt.wikipedia.org/wiki/Recife',
      title: 'Recife',
      snippet: 'Capital de Pernambuco',
      engines: ['wikipedia', 'google'],
      score: 2.5,
      publishedDate: '2024-01-02T00:00:00',
    });
    expect(hits[1]?.publishedDate).toBeUndefined();
  });

  it('passes language, categories and time range through as query params', async () => {
    const fetchFn = mock(async (_url: URL | string, _init?: RequestInit) =>
      jsonResponse(twoResults),
    );
    const client = new SearxngClient({ fetchFn });

    await client.search('recife', {
      language: 'pt-BR',
      categories: 'news',
      timeRange: 'month',
    });

    const requested = String(fetchFn.mock.calls[0]?.[0]);
    expect(requested).toContain('language=pt-BR');
    expect(requested).toContain('categories=news');
    expect(requested).toContain('time_range=month');
  });

  it('omits optional params when they are not given', async () => {
    const fetchFn = mock(async (_url: URL | string, _init?: RequestInit) =>
      jsonResponse(twoResults),
    );
    const client = new SearxngClient({ fetchFn });

    await client.search('recife');

    const requested = String(fetchFn.mock.calls[0]?.[0]);
    expect(requested).not.toContain('time_range');
    expect(requested).not.toContain('categories');
  });

  it('caps the number of hits at the requested limit', async () => {
    const many = {
      results: Array.from({ length: 30 }, (_, i) => ({
        url: `https://example.com/${i}`,
        title: `t${i}`,
        content: '',
        engines: ['google'],
        score: 1,
      })),
    };
    const fetchFn = mock(async () => jsonResponse(many));
    const client = new SearxngClient({ fetchFn });

    const hits = await client.search('x', { limit: 5 });

    expect(hits).toHaveLength(5);
  });

  it('drops results without a usable http(s) url', async () => {
    const fetchFn = mock(async () =>
      jsonResponse({
        results: [
          { url: 'ftp://example.com/f', title: 'ftp', content: '' },
          { url: '', title: 'vazio', content: '' },
          { url: 'https://ok.example.com', title: 'ok', content: '' },
        ],
      }),
    );
    const client = new SearxngClient({ fetchFn });

    const hits = await client.search('x');

    expect(hits).toHaveLength(1);
    expect(hits[0]?.url).toBe('https://ok.example.com');
  });

  it('deduplicates the same url returned more than once', async () => {
    const fetchFn = mock(async () =>
      jsonResponse({
        results: [
          { url: 'https://a.example.com/p', title: 'a', content: '', score: 1 },
          { url: 'https://a.example.com/p', title: 'a', content: '', score: 3 },
        ],
      }),
    );
    const client = new SearxngClient({ fetchFn });

    const hits = await client.search('x');

    expect(hits).toHaveLength(1);
  });

  it('throws a SearxngError with the status when the instance fails', async () => {
    const fetchFn = mock(async () => jsonResponse({}, 503));
    const client = new SearxngClient({ fetchFn });

    const promise = client.search('x');

    expect(promise).rejects.toThrow(SearxngError);
    expect(promise).rejects.toThrow('503');
  });

  it('throws a SearxngError when the body is not valid json', async () => {
    const fetchFn = mock(
      async () =>
        new Response('<html>blocked</html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
    );
    const client = new SearxngClient({ fetchFn });

    expect(client.search('x')).rejects.toThrow(SearxngError);
  });

  it('returns an empty list when the instance has no results for the query', async () => {
    const fetchFn = mock(async () => jsonResponse({ results: [] }));
    const client = new SearxngClient({ fetchFn });

    expect(await client.search('asdkjhasd')).toEqual([]);
  });

  it('aborts the request with a signal so a hung instance cannot stall a job', async () => {
    const fetchFn = mock(async (_url: URL | string, init?: RequestInit) => {
      expect(init?.signal).toBeDefined();
      return jsonResponse(twoResults);
    });
    const client = new SearxngClient({ fetchFn });

    await client.search('x');

    expect(fetchFn).toHaveBeenCalled();
  });
});

describe('SearxngClient.searchDetailed', () => {
  it('returns the same hits search() does, under a hits key', async () => {
    const fetchFn = mock(async () => jsonResponse(twoResults));
    const client = new SearxngClient({ fetchFn, baseUrl: 'https://s.example' });

    const detailed = await client.searchDetailed('recife');

    expect(detailed.hits.map((entry) => entry.url)).toEqual([
      'https://pt.wikipedia.org/wiki/Recife',
      'https://recife.pe.gov.br/',
    ]);
  });

  it('reports the engines that did not answer', async () => {
    // An instance whose engines all timed out answers 200 with results: [],
    // which is otherwise indistinguishable from a topic nobody wrote about.
    const fetchFn = mock(async () =>
      jsonResponse({
        results: [],
        unresponsive_engines: [
          ['google', 'CAPTCHA'],
          ['duckduckgo', 'timeout'],
        ],
      }),
    );
    const client = new SearxngClient({ fetchFn, baseUrl: 'https://s.example' });

    const detailed = await client.searchDetailed('recife');

    expect(detailed.hits).toEqual([]);
    expect(detailed.unresponsiveEngines).toEqual(['google', 'duckduckgo']);
  });

  it('handles a flat unresponsive_engines list and a missing one alike', async () => {
    const flat = new SearxngClient({
      fetchFn: mock(async () =>
        jsonResponse({ results: [], unresponsive_engines: ['brave'] }),
      ),
      baseUrl: 'https://s.example',
    });
    const absent = new SearxngClient({
      fetchFn: mock(async () => jsonResponse({ results: [] })),
      baseUrl: 'https://s.example',
    });

    expect((await flat.searchDetailed('x')).unresponsiveEngines).toEqual([
      'brave',
    ]);
    expect((await absent.searchDetailed('x')).unresponsiveEngines).toEqual([]);
  });
});
