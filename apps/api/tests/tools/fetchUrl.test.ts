import { describe, expect, it, mock } from 'bun:test';
import {
  createFetchUrlTool,
  MAX_BODY_BYTES,
  MAX_LINKS,
  MAX_TEXT_CHARS,
} from 'services/aiChat/tools/fetchUrl';
import type { AgentToolContext } from 'services/aiChat/tools/types';

const ctx: AgentToolContext = {
  containerId: 'c1',
  exec: async () => ({ stdout: '', stderr: '', exitCode: 0 }),
};

function publicLookup() {
  return mock(async () => [{ address: '93.184.216.34', family: 4 }]);
}

function htmlResponse(body: string) {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

describe('fetchUrlTool scheme guard', () => {
  it.each([
    ['http://example.com', 'http'],
    ['file:///etc/passwd', 'file'],
    ['ftp://example.com', 'ftp'],
    ['gopher://example.com', 'gopher'],
  ])('rejects %s without ever calling fetch', async (url) => {
    const fetchFn = mock(async () => htmlResponse('<html></html>'));
    const lookupFn = publicLookup();
    const tool = createFetchUrlTool({ fetchFn, lookupFn });

    const result = await tool.execute({ url }, ctx);

    expect(fetchFn).not.toHaveBeenCalled();
    expect(lookupFn).not.toHaveBeenCalled();
    expect(result).toContain('https');
  });

  it('rejects a malformed url without calling fetch', async () => {
    const fetchFn = mock(async () => htmlResponse('<html></html>'));
    const tool = createFetchUrlTool({ fetchFn, lookupFn: publicLookup() });

    const result = await tool.execute({ url: 'not a url' }, ctx);

    expect(fetchFn).not.toHaveBeenCalled();
    expect(result.toLowerCase()).toContain('url');
  });
});

describe('fetchUrlTool SSRF guard', () => {
  it.each([
    ['127.0.0.1', 4],
    ['10.0.0.1', 4],
    ['192.168.1.1', 4],
    ['172.16.0.1', 4],
    ['169.254.169.254', 4],
    ['100.64.0.1', 4],
    ['0.0.0.0', 4],
    ['224.0.0.1', 4],
    ['::1', 6],
    ['fc00::1', 6],
    ['fd00::1', 6],
    ['fe80::1', 6],
    ['::ffff:127.0.0.1', 6],
  ])('refuses a host that resolves to %s', async (address, family) => {
    const fetchFn = mock(async () => htmlResponse('<html></html>'));
    const lookupFn = mock(async () => [{ address, family }]);
    const tool = createFetchUrlTool({ fetchFn, lookupFn });

    const result = await tool.execute(
      { url: 'https://internal.example.com' },
      ctx,
    );

    expect(fetchFn).not.toHaveBeenCalled();
    expect(result).toContain('interno');
  });

  it('refuses when only one of several resolved addresses is internal', async () => {
    const fetchFn = mock(async () => htmlResponse('<html></html>'));
    const lookupFn = mock(async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '10.1.2.3', family: 4 },
    ]);
    const tool = createFetchUrlTool({ fetchFn, lookupFn });

    const result = await tool.execute(
      { url: 'https://split.example.com' },
      ctx,
    );

    expect(fetchFn).not.toHaveBeenCalled();
    expect(result).toContain('interno');
  });

  it('allows a host that resolves only to public addresses', async () => {
    const fetchFn = mock(async () => htmlResponse('<html><p>oi</p></html>'));
    const tool = createFetchUrlTool({ fetchFn, lookupFn: publicLookup() });

    const result = await tool.execute({ url: 'https://example.com' }, ctx);

    expect(fetchFn).toHaveBeenCalled();
    expect(result).toContain('oi');
  });

  it('surfaces a dns failure as a clear message instead of throwing', async () => {
    const fetchFn = mock(async () => htmlResponse('<html></html>'));
    const lookupFn = mock(async () => {
      throw new Error('ENOTFOUND');
    });
    const tool = createFetchUrlTool({ fetchFn, lookupFn });

    const result = await tool.execute({ url: 'https://nope.example.com' }, ctx);

    expect(fetchFn).not.toHaveBeenCalled();
    expect(result).toContain('resolver');
  });
});

describe('fetchUrlTool redirects', () => {
  it('follows a redirect and returns the final body', async () => {
    const fetchFn = mock(async (input: string | URL) => {
      if (String(input).includes('/start')) {
        return new Response(null, {
          status: 302,
          headers: { location: 'https://example.com/final' },
        });
      }
      return htmlResponse('<html><p>chegou</p></html>');
    });
    const tool = createFetchUrlTool({ fetchFn, lookupFn: publicLookup() });

    const result = await tool.execute(
      { url: 'https://example.com/start' },
      ctx,
    );

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(result).toContain('chegou');
  });

  it('revalidates each redirect hop and blocks a hop pointing at link-local', async () => {
    const fetchFn = mock(async (input: string | URL) => {
      if (String(input).includes('example.com')) {
        return new Response(null, {
          status: 302,
          headers: { location: 'https://169.254.169.254/latest/meta-data/' },
        });
      }
      return htmlResponse('<html><p>SEGREDO</p></html>');
    });
    const lookupFn = mock(async (hostname: string) =>
      hostname === '169.254.169.254'
        ? [{ address: '169.254.169.254', family: 4 }]
        : [{ address: '93.184.216.34', family: 4 }],
    );
    const tool = createFetchUrlTool({ fetchFn, lookupFn });

    const result = await tool.execute({ url: 'https://example.com' }, ctx);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(result).toContain('interno');
    expect(result).not.toContain('SEGREDO');
  });

  it('gives up after too many redirects', async () => {
    let n = 0;
    const fetchFn = mock(async () => {
      n++;
      return new Response(null, {
        status: 302,
        headers: { location: `https://example.com/hop${n}` },
      });
    });
    const tool = createFetchUrlTool({ fetchFn, lookupFn: publicLookup() });

    const result = await tool.execute({ url: 'https://example.com/hop0' }, ctx);

    expect(result).toContain('redirect');
    expect(fetchFn.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it('reports a redirect with no location header instead of hanging', async () => {
    const fetchFn = mock(
      async () => new Response(null, { status: 302, headers: {} }),
    );
    const tool = createFetchUrlTool({ fetchFn, lookupFn: publicLookup() });

    const result = await tool.execute({ url: 'https://example.com' }, ctx);

    expect(result.toLowerCase()).toContain('redirect');
  });
});

describe('fetchUrlTool response handling', () => {
  it('rejects a binary content-type', async () => {
    const fetchFn = mock(
      async () =>
        new Response('\x89PNG', {
          status: 200,
          headers: { 'content-type': 'image/png' },
        }),
    );
    const tool = createFetchUrlTool({ fetchFn, lookupFn: publicLookup() });

    const result = await tool.execute(
      { url: 'https://example.com/x.png' },
      ctx,
    );

    expect(result).toContain('image/png');
  });

  it('reports a non-ok status with the status code', async () => {
    const fetchFn = mock(
      async () =>
        new Response('nope', {
          status: 404,
          headers: { 'content-type': 'text/html' },
        }),
    );
    const tool = createFetchUrlTool({ fetchFn, lookupFn: publicLookup() });

    const result = await tool.execute({ url: 'https://example.com/404' }, ctx);

    expect(result).toContain('404');
  });

  it('caps the body it reads and says the content was truncated', async () => {
    const huge = `<html><p>${'a'.repeat(MAX_BODY_BYTES + 50_000)}</p></html>`;
    const fetchFn = mock(async () => htmlResponse(huge));
    const tool = createFetchUrlTool({ fetchFn, lookupFn: publicLookup() });

    const result = await tool.execute({ url: 'https://example.com/big' }, ctx);

    expect(result.length).toBeLessThan(MAX_TEXT_CHARS + 500);
    expect(result).toContain('truncado');
  });

  it('returns json bodies verbatim rather than stripping them as html', async () => {
    const fetchFn = mock(
      async () =>
        new Response('{"hops":["Recife","Roma"]}', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const tool = createFetchUrlTool({ fetchFn, lookupFn: publicLookup() });

    const result = await tool.execute({ url: 'https://example.com/api' }, ctx);

    expect(result).toContain('{"hops":["Recife","Roma"]}');
  });

  it('sends a bot user-agent and no credentials', async () => {
    const fetchFn = mock(async (_input: URL | string, _init?: RequestInit) =>
      htmlResponse('<html>ok</html>'),
    );
    const tool = createFetchUrlTool({ fetchFn, lookupFn: publicLookup() });

    await tool.execute({ url: 'https://example.com' }, ctx);

    const init = fetchFn.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>)['user-agent']).toContain(
      'Marquinhos',
    );
    expect(init.redirect).toBe('manual');
    expect(init.credentials).toBe('omit');
    expect(init.signal).toBeDefined();
  });
});

describe('fetchUrlTool text mode', () => {
  it('strips script and style content and collapses whitespace', async () => {
    const html = `<html><head><style>.a{color:red}</style>
      <script>var segredo = "NAO_VAZAR";</script></head>
      <body><h1>Recife</h1>   <p>capital   de Pernambuco</p></body></html>`;
    const fetchFn = mock(async () => htmlResponse(html));
    const tool = createFetchUrlTool({ fetchFn, lookupFn: publicLookup() });

    const result = await tool.execute(
      { url: 'https://pt.wikipedia.org/wiki/Recife', mode: 'text' },
      ctx,
    );

    expect(result).toContain('Recife');
    expect(result).toContain('capital de Pernambuco');
    expect(result).not.toContain('NAO_VAZAR');
    expect(result).not.toContain('color:red');
  });

  it('defaults to text mode when mode is omitted', async () => {
    const fetchFn = mock(async () =>
      htmlResponse('<html><p>padrao</p></html>'),
    );
    const tool = createFetchUrlTool({ fetchFn, lookupFn: publicLookup() });

    const result = await tool.execute({ url: 'https://example.com' }, ctx);

    expect(result).toContain('padrao');
  });

  it('truncates long text at the character cap', async () => {
    const html = `<html><p>${'b'.repeat(MAX_TEXT_CHARS * 2)}</p></html>`;
    const fetchFn = mock(async () => htmlResponse(html));
    const tool = createFetchUrlTool({ fetchFn, lookupFn: publicLookup() });

    const result = await tool.execute({ url: 'https://example.com' }, ctx);

    expect(result).toContain('truncado');
    expect(result.length).toBeLessThan(MAX_TEXT_CHARS + 500);
  });
});

describe('fetchUrlTool markdown conversion', () => {
  it('renders headings as atx markdown', async () => {
    const fetchFn = mock(async () =>
      htmlResponse('<html><body><h1>Recife</h1></body></html>'),
    );
    const tool = createFetchUrlTool({ fetchFn, lookupFn: publicLookup() });

    const result = await tool.execute({ url: 'https://example.com' }, ctx);

    expect(result).toContain('# Recife');
  });

  it('renders lists as markdown bullets', async () => {
    const fetchFn = mock(async () =>
      htmlResponse('<html><body><ul><li>a</li><li>b</li></ul></body></html>'),
    );
    const tool = createFetchUrlTool({ fetchFn, lookupFn: publicLookup() });

    const result = await tool.execute({ url: 'https://example.com' }, ctx);

    expect(result).toMatch(/^-\s+a$/m);
    expect(result).toMatch(/^-\s+b$/m);
  });

  it('renders tables as gfm pipe tables', async () => {
    const html = `<html><body><table>
      <tr><th>A</th><th>B</th></tr>
      <tr><td>1</td><td>2</td></tr>
    </table></body></html>`;
    const fetchFn = mock(async () => htmlResponse(html));
    const tool = createFetchUrlTool({ fetchFn, lookupFn: publicLookup() });

    const result = await tool.execute({ url: 'https://example.com' }, ctx);

    expect(result).toContain('| A | B |');
    expect(result).toMatch(/\|\s*-+\s*\|\s*-+\s*\|/);
    expect(result).toContain('| 1 | 2 |');
  });

  it('renders links as absolute markdown links in text mode', async () => {
    const fetchFn = mock(async () =>
      htmlResponse('<html><body><a href="/wiki/Roma">Roma</a></body></html>'),
    );
    const tool = createFetchUrlTool({ fetchFn, lookupFn: publicLookup() });

    const result = await tool.execute(
      { url: 'https://pt.wikipedia.org/wiki/Recife' },
      ctx,
    );

    expect(result).toContain('[Roma](https://pt.wikipedia.org/wiki/Roma)');
  });

  it('drops images instead of emitting markdown image syntax', async () => {
    const fetchFn = mock(async () =>
      htmlResponse(
        '<html><body><img src="https://example.com/x.png" alt="foto"></body></html>',
      ),
    );
    const tool = createFetchUrlTool({ fetchFn, lookupFn: publicLookup() });

    const result = await tool.execute({ url: 'https://example.com' }, ctx);

    expect(result).not.toContain('![foto]');
    expect(result).not.toContain('x.png');
  });

  it('keeps the language hint on fenced code blocks', async () => {
    const fetchFn = mock(async () =>
      htmlResponse(
        '<html><body><pre><code class="language-js">const x = 1;</code></pre></body></html>',
      ),
    );
    const tool = createFetchUrlTool({ fetchFn, lookupFn: publicLookup() });

    const result = await tool.execute({ url: 'https://example.com' }, ctx);

    expect(result).toContain('```js');
    expect(result).toContain('const x = 1;');
  });

  it('still fences code blocks without a language class', async () => {
    const fetchFn = mock(async () =>
      htmlResponse('<html><body><pre><code>plain</code></pre></body></html>'),
    );
    const tool = createFetchUrlTool({ fetchFn, lookupFn: publicLookup() });

    const result = await tool.execute({ url: 'https://example.com' }, ctx);

    expect(result).toContain('```');
    expect(result).toContain('plain');
    expect(result).not.toContain('undefined');
  });

  it('strips navigation, header, and footer chrome but keeps the main content', async () => {
    const html = `<html><body>
      <nav><a href="/menu">Menu</a></nav>
      <header>Site Header</header>
      <main><p>conteudo real</p></main>
      <footer>rodape</footer>
    </body></html>`;
    const fetchFn = mock(async () => htmlResponse(html));
    const tool = createFetchUrlTool({ fetchFn, lookupFn: publicLookup() });

    const result = await tool.execute({ url: 'https://example.com' }, ctx);

    expect(result).toContain('conteudo real');
    expect(result).not.toContain('Menu');
    expect(result).not.toContain('Site Header');
    expect(result).not.toContain('rodape');
  });

  it('tolerates malformed html without throwing', async () => {
    const fetchFn = mock(async () =>
      htmlResponse('<html><body><p>oi<div>sem fechar</html>'),
    );
    const tool = createFetchUrlTool({ fetchFn, lookupFn: publicLookup() });

    const result = await tool.execute({ url: 'https://example.com' }, ctx);

    expect(result).toContain('oi');
    expect(result).toContain('sem fechar');
  });
});

describe('fetchUrlTool links mode', () => {
  const wikiHtml = `<html><body>
    <a href="/wiki/Pernambuco">Pernambuco</a>
    <a href="/wiki/Pernambuco">Pernambuco de novo</a>
    <a href="/wiki/Roma#historia">Roma</a>
    <a href="https://pt.wikipedia.org/wiki/Coliseu">Coliseu</a>
    <a href="https://outrosite.com/externo">Externo</a>
    <a href="mailto:alguem@example.com">Email</a>
    <a href="/wiki/It%C3%A1lia"><span>Itália</span></a>
  </body></html>`;

  async function runLinks() {
    const fetchFn = mock(async () => htmlResponse(wikiHtml));
    const tool = createFetchUrlTool({ fetchFn, lookupFn: publicLookup() });
    return tool.execute(
      { url: 'https://pt.wikipedia.org/wiki/Recife', mode: 'links' },
      ctx,
    );
  }

  it('resolves relative links against the page url', async () => {
    expect(await runLinks()).toContain(
      'https://pt.wikipedia.org/wiki/Pernambuco',
    );
  });

  it('keeps the link label next to the url so the model can choose a hop', async () => {
    const result = await runLinks();
    expect(result).toContain('Coliseu');
    expect(result).toContain('https://pt.wikipedia.org/wiki/Coliseu');
  });

  it('deduplicates repeated targets and strips fragments', async () => {
    const result = await runLinks();
    const occurrences = result.split('/wiki/Pernambuco').length - 1;
    expect(occurrences).toBe(1);
    expect(result).not.toContain('#historia');
  });

  it('drops off-host links and non-http schemes', async () => {
    const result = await runLinks();
    expect(result).not.toContain('outrosite.com');
    expect(result).not.toContain('mailto:');
  });

  it('drops in-page anchors that collapse to the current page, which are not hops', async () => {
    const html = `<html><body>
      <a href="#conteudo">Ir para o conteúdo</a>
      <a href="/wiki/Recife#topo">Voltar ao topo</a>
      <a href="/wiki/Roma">Roma</a>
    </body></html>`;
    const fetchFn = mock(async () => htmlResponse(html));
    const tool = createFetchUrlTool({ fetchFn, lookupFn: publicLookup() });

    const result = await tool.execute(
      { url: 'https://pt.wikipedia.org/wiki/Recife', mode: 'links' },
      ctx,
    );

    expect(result).toContain('/wiki/Roma');
    expect(result).not.toContain('Ir para o conteúdo');
    expect(result).not.toContain('Voltar ao topo');
  });

  it('decodes html entities in the href so query strings are not broken', async () => {
    const html =
      '<html><a href="/w/index.php?title=Recife&amp;action=edit">editar</a></html>';
    const fetchFn = mock(async () => htmlResponse(html));
    const tool = createFetchUrlTool({ fetchFn, lookupFn: publicLookup() });

    const result = await tool.execute(
      { url: 'https://pt.wikipedia.org/wiki/Recife', mode: 'links' },
      ctx,
    );

    expect(result).toContain('title=Recife&action=edit');
    expect(result).not.toContain('&amp;');
  });

  it('strips nested tags out of the link label', async () => {
    const result = await runLinks();
    expect(result).toContain('Itália');
    expect(result).not.toContain('<span>');
  });

  it('limits how many links it returns', async () => {
    const many = Array.from(
      { length: MAX_LINKS + 40 },
      (_, i) => `<a href="/wiki/P${i}">P${i}</a>`,
    ).join('');
    const fetchFn = mock(async () => htmlResponse(`<html>${many}</html>`));
    const tool = createFetchUrlTool({ fetchFn, lookupFn: publicLookup() });

    const result = await tool.execute(
      { url: 'https://pt.wikipedia.org/wiki/X', mode: 'links' },
      ctx,
    );

    expect(result.split('\n').filter((l) => l.includes('/wiki/P')).length).toBe(
      MAX_LINKS,
    );
  });

  it('says so when a page has no usable links', async () => {
    const fetchFn = mock(async () => htmlResponse('<html><p>nada</p></html>'));
    const tool = createFetchUrlTool({ fetchFn, lookupFn: publicLookup() });

    const result = await tool.execute(
      { url: 'https://example.com', mode: 'links' },
      ctx,
    );

    expect(result).toContain('nenhum link');
  });
});
