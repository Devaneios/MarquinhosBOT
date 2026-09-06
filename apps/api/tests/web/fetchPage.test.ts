import { describe, expect, it, mock } from 'bun:test';
import {
  createPageFetcher,
  FetchPageError,
  MAX_BODY_BYTES,
} from 'services/aiChat/web/fetchPage';

function publicLookup() {
  return mock(async () => [{ address: '93.184.216.34', family: 4 }]);
}

function htmlResponse(body: string) {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

function fetcherFor(body: string) {
  return createPageFetcher({
    fetchFn: mock(async () => htmlResponse(body)),
    lookupFn: publicLookup(),
  });
}

describe('fetchPage result shape', () => {
  it('reports the final url after a redirect, not the requested one', async () => {
    const fetchFn = mock(async (input: URL | string) =>
      String(input).includes('/start')
        ? new Response(null, {
            status: 302,
            headers: { location: 'https://example.com/final' },
          })
        : htmlResponse('<html><body><p>fim</p></body></html>'),
    );
    const fetchPage = createPageFetcher({ fetchFn, lookupFn: publicLookup() });

    const page = await fetchPage('https://example.com/start');

    expect(page.finalUrl).toBe('https://example.com/final');
    expect(page.content).toContain('fim');
  });

  it('extracts the document title so a citation can name the source', async () => {
    const page = await fetcherFor(
      '<html><head><title>  Recife —  Wikipédia </title></head><body><p>x</p></body></html>',
    )('https://pt.wikipedia.org/wiki/Recife');

    expect(page.title).toBe('Recife — Wikipédia');
  });

  it('falls back to og:title when there is no title tag', async () => {
    const page = await fetcherFor(
      '<html><head><meta property="og:title" content="Do OG"></head><body>x</body></html>',
    )('https://example.com');

    expect(page.title).toBe('Do OG');
  });

  it('falls back to the first h1 when there is no title and no og:title', async () => {
    const page = await fetcherFor(
      '<html><body><h1>Do H1</h1><p>x</p></body></html>',
    )('https://example.com');

    expect(page.title).toBe('Do H1');
  });

  it('leaves the title empty when the page offers none', async () => {
    const page = await fetcherFor('<html><body><p>x</p></body></html>')(
      'https://example.com',
    );

    expect(page.title).toBe('');
  });

  it('marks html responses as html and non-html as not', async () => {
    const htmlPage = await fetcherFor('<html><body>x</body></html>')(
      'https://example.com',
    );
    expect(htmlPage.isHtml).toBe(true);

    const jsonFetcher = createPageFetcher({
      fetchFn: mock(
        async () =>
          new Response('{"a":1}', {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      ),
      lookupFn: publicLookup(),
    });
    const jsonPage = await jsonFetcher('https://example.com/api');

    expect(jsonPage.isHtml).toBe(false);
    expect(jsonPage.content).toBe('{"a":1}');
    expect(jsonPage.title).toBe('');
  });

  it('returns markdown uncapped so each caller picks its own budget', async () => {
    const long = 'palavra '.repeat(2000);
    const page = await fetcherFor(`<html><body><p>${long}</p></body></html>`)(
      'https://example.com',
    );

    expect(page.content.length).toBeGreaterThan(5000);
    expect(page.content).not.toContain('truncado');
  });

  it('flags truncated when the body hits the byte cap', async () => {
    const huge = `<html><body><p>${'a'.repeat(MAX_BODY_BYTES + 50_000)}</p></body></html>`;
    const page = await fetcherFor(huge)('https://example.com/big');

    expect(page.truncated).toBe(true);
  });

  it('fails loudly when the cap cut the body before any readable content', async () => {
    // A real shape: a huge nav sidebar eats the cap, the nav is stripped as
    // noise, and what is left is nothing. Silently reporting an empty page here
    // is what made research sources disappear without a trace.
    const navHeavy = `<html><body><nav>${'<a href="/x">link</a>'.repeat(
      Math.ceil(MAX_BODY_BYTES / 20),
    )}</nav><main><p>o conteúdo de verdade</p></main></body></html>`;

    expect(fetcherFor(navHeavy)('https://example.com/docs')).rejects.toThrow(
      /grande|cap|truncad/i,
    );
  });

  it('reads a pdf by extracting its text', async () => {
    const fetchFn = mock(
      async () =>
        new Response(new Uint8Array([37, 80, 68, 70]), {
          status: 200,
          headers: { 'content-type': 'application/pdf' },
        }),
    );
    const extractPdfText = mock(async () => ({
      text: 'Artificial Intelligence Risk Management Framework',
      title: 'NIST AI 100-1',
    }));

    const page = await createPageFetcher({
      fetchFn,
      lookupFn: publicLookup(),
      extractPdfText,
    })('https://nist.gov/report.pdf');

    expect(page.content).toContain('Risk Management Framework');
    expect(page.title).toBe('NIST AI 100-1');
    expect(page.isHtml).toBe(false);
    expect(extractPdfText).toHaveBeenCalled();
  });

  it('refuses a pdf the byte cap cut, since a partial pdf cannot be parsed', async () => {
    const fetchFn = mock(
      async () =>
        new Response(new Uint8Array(MAX_BODY_BYTES + 1024), {
          status: 200,
          headers: { 'content-type': 'application/pdf' },
        }),
    );
    const extractPdfText = mock(async () => ({ text: 'x', title: '' }));

    expect(
      createPageFetcher({
        fetchFn,
        lookupFn: publicLookup(),
        extractPdfText,
      })('https://example.com/huge.pdf'),
    ).rejects.toThrow(/pdf/i);
    expect(extractPdfText).not.toHaveBeenCalled();
  });

  it('surfaces a pdf it could not parse as a skippable failure', async () => {
    const fetchFn = mock(
      async () =>
        new Response(new Uint8Array([37, 80, 68, 70]), {
          status: 200,
          headers: { 'content-type': 'application/pdf' },
        }),
    );
    const extractPdfText = mock(async () => {
      throw new Error('Invalid PDF structure.');
    });

    const promise = createPageFetcher({
      fetchFn,
      lookupFn: publicLookup(),
      extractPdfText,
    })('https://example.com/broken.pdf');

    expect(promise).rejects.toBeInstanceOf(FetchPageError);
  });

  it('asks for html first but accepts anything, so servers do not answer 406', async () => {
    const fetchFn = mock(async () =>
      htmlResponse('<html><body><p>ok</p></body></html>'),
    );
    await createPageFetcher({ fetchFn, lookupFn: publicLookup() })(
      'https://example.com',
    );

    const init = (
      fetchFn.mock.calls as unknown as [URL | string, RequestInit][]
    )[0]![1] as { headers: Record<string, string> };
    expect(init.headers.accept).toMatch(/^text\/html/);
    expect(init.headers.accept).toContain('*/*');
  });

  it('still reports an empty page as empty when nothing was truncated', async () => {
    const page = await fetcherFor('<html><body><nav>menu</nav></body></html>')(
      'https://example.com',
    );

    expect(page.content).toBe('');
    expect(page.truncated).toBe(false);
  });

  it('returns no links in text mode and no content in links mode', async () => {
    const html = '<html><body><a href="/a">A</a><p>texto</p></body></html>';

    const textPage = await fetcherFor(html)('https://example.com');
    expect(textPage.links).toEqual([]);
    expect(textPage.content).toContain('texto');

    const linksPage = await fetcherFor(html)('https://example.com', {
      mode: 'links',
    });
    expect(linksPage.content).toBe('');
    expect(linksPage.links[0]).toContain('https://example.com/a');
  });
});

describe('fetchPage failures', () => {
  it.each([
    ['http://example.com', 'https'],
    ['not a url', 'URL'],
  ])('throws FetchPageError for %s', async (url, expected) => {
    const fetchFn = mock(async () => htmlResponse('<html></html>'));
    const fetchPage = createPageFetcher({ fetchFn, lookupFn: publicLookup() });

    const promise = fetchPage(url);

    expect(promise).rejects.toThrow(FetchPageError);
    expect(promise).rejects.toThrow(expected);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('throws FetchPageError for a host resolving to a private address', async () => {
    const fetchFn = mock(async () => htmlResponse('<html>SEGREDO</html>'));
    const fetchPage = createPageFetcher({
      fetchFn,
      lookupFn: mock(async () => [{ address: '169.254.169.254', family: 4 }]),
    });

    expect(fetchPage('https://metadata.internal')).rejects.toThrow('interno');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('throws FetchPageError carrying the http status', async () => {
    const fetchPage = createPageFetcher({
      fetchFn: mock(
        async () =>
          new Response('nope', {
            status: 404,
            headers: { 'content-type': 'text/html' },
          }),
      ),
      lookupFn: publicLookup(),
    });

    expect(fetchPage('https://example.com/404')).rejects.toThrow('404');
  });

  it('throws FetchPageError for a content type it cannot read', async () => {
    const fetchPage = createPageFetcher({
      fetchFn: mock(
        async () =>
          new Response('\x89PNG', {
            status: 200,
            headers: { 'content-type': 'image/png' },
          }),
      ),
      lookupFn: publicLookup(),
    });

    expect(fetchPage('https://example.com/x.png')).rejects.toThrow('image/png');
  });

  it('throws FetchPageError when links mode is asked of a non-html page', async () => {
    const fetchPage = createPageFetcher({
      fetchFn: mock(
        async () =>
          new Response('{"a":1}', {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      ),
      lookupFn: publicLookup(),
    });

    expect(
      fetchPage('https://example.com/api', { mode: 'links' }),
    ).rejects.toThrow('não é HTML');
  });

  it('honours a caller-supplied timeout in the message', async () => {
    const fetchPage = createPageFetcher({
      fetchFn: mock(async () => {
        const error = new Error('timed out');
        error.name = 'TimeoutError';
        throw error;
      }),
      lookupFn: publicLookup(),
    });

    expect(
      fetchPage('https://slow.example.com', { timeoutMs: 2000 }),
    ).rejects.toThrow('2s');
  });
});
