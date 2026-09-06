import { describe, expect, it, mock } from 'bun:test';
import type { ResponsesClient } from 'services/aiChat/llm/ResponsesClient';
import {
  DeepResearchService,
  MAX_FRONTIER_DEPTH,
  MIN_RELEVANT_SOURCES,
  relaxQuery,
  sanitizeQuery,
} from 'services/aiChat/research/DeepResearchService';
import {
  FetchPageError,
  type FetchedPage,
  type PageFetcher,
} from 'services/aiChat/web/fetchPage';
import {
  SearxngError,
  type SearchHit,
  type SearxngClient,
} from 'services/aiChat/web/SearxngClient';

function hit(url: string, title = url): SearchHit {
  return { url, title, snippet: '', engines: ['google'], score: 1 };
}

function page(content: string, title = 'Titulo'): FetchedPage {
  return {
    finalUrl: 'https://a.com/p',
    contentType: 'text/html',
    isHtml: true,
    truncated: false,
    title,
    content,
    links: [],
  };
}

const plan = {
  objective: 'descobrir o estado da arte de X',
  facets: [
    { id: 'base', question: 'o que é X' },
    { id: 'numeros', question: 'quanto custa X' },
  ],
  subQueries: [
    {
      query: 'x definicao',
      facetId: 'base',
      angle: 'definicao',
      rationale: 'base',
    },
    {
      query: 'x dados 2026',
      facetId: 'numeros',
      angle: 'dados',
      rationale: 'numeros',
    },
  ],
};

const relevantExtraction = {
  relevant: true,
  sourceType: 'secundaria',
  summary: 'a pagina explica X',
  facetIds: ['base', 'numeros'],
  claims: ['X custa 10 reais'],
  quotes: [],
  entities: [],
  openQuestions: [],
  contradictions: [],
  followUpQueries: [],
  publishedDate: '2026-01-15',
};

const irrelevantExtraction = {
  relevant: false,
  sourceType: 'agregador',
  summary: 'pagina de erro',
  facetIds: [],
  claims: [],
  quotes: [],
  entities: [],
  openQuestions: [],
  contradictions: [],
  followUpQueries: [],
  publishedDate: null,
};

const analysis = {
  facetFindings: [{ facetId: 'base', finding: 'X é isso', sourceIndexes: [1] }],
  agreements: [],
  contradictions: [],
  unverified: [],
  outline: ['O que é X'],
};

/** Every url the triage step was shown, in the order the input listed them. */
function candidateUrls(content: string): string[] {
  return [...content.matchAll(/<url>(.*?)<\/url>/g)].map((match) => match[1]!);
}

/**
 * Drives the service by phase prefix rather than call order, since the pipeline
 * fans out and the order of extract calls is not deterministic.
 *
 * The default triage picks every candidate it is shown, so a test that does not
 * care about triage sees the same selection the ranking produced.
 */
function fakeClient(
  overrides: {
    plan?: unknown;
    triage?: unknown | ((urls: string[]) => unknown);
    extraction?: unknown | ((phase: string) => unknown);
    reflection?: unknown[];
    analysis?: unknown;
    synthesis?: string;
    fail?: (phase: string) => boolean;
  } = {},
) {
  let reflectionCall = 0;
  const structured = mock(
    async (options: { phase?: string; input: { content: string }[] }) => {
      const phase = options.phase ?? '';
      if (overrides.fail?.(phase)) throw new Error(`${phase} down`);
      if (phase === 'research_plan') return overrides.plan ?? plan;
      if (phase.startsWith('research_triage')) {
        const urls = candidateUrls(options.input[0]!.content);
        const value = overrides.triage;
        if (typeof value === 'function') {
          return (value as (u: string[]) => unknown)(urls);
        }
        if (value) return value;
        return {
          picks: urls.map((url) => ({
            url,
            priority: 'media',
            reason: 'serve',
          })),
        };
      }
      if (phase.startsWith('research_extract')) {
        const value = overrides.extraction ?? relevantExtraction;
        return typeof value === 'function'
          ? (value as (p: string) => unknown)(phase)
          : value;
      }
      if (phase.startsWith('research_reflect')) {
        const list = overrides.reflection ?? [
          { sufficient: true, gaps: [], followUpQueries: [] },
        ];
        return list[Math.min(reflectionCall++, list.length - 1)];
      }
      if (phase === 'research_analyze') return overrides.analysis ?? analysis;
      throw new Error(`unexpected structured phase: ${phase}`);
    },
  );
  const create = mock(async () => ({
    items: [],
    text: overrides.synthesis ?? '## Resumo\n\nachei isso [1].',
    functionCalls: [],
    reasoningSummaries: [],
  }));
  return { structured, create } as unknown as ResponsesClient;
}

function fakeSearxng(
  results: SearchHit[][] | ((query: string) => SearchHit[]),
  unresponsiveEngines: string[] = [],
): SearxngClient {
  let call = 0;
  return {
    searchDetailed: mock(async (query: string) => ({
      hits:
        typeof results === 'function'
          ? results(query)
          : (results[call++] ?? []),
      unresponsiveEngines,
    })),
  } as unknown as SearxngClient;
}

/** A backend where every query throws, e.g. the instance being down. */
function brokenSearxng(message: string): SearxngClient {
  return {
    searchDetailed: mock(async () => {
      throw new SearxngError(message);
    }),
  } as unknown as SearxngClient;
}

function fakeFetcher(
  impl: (url: string) => Promise<FetchedPage> = async () =>
    page('conteudo relevante'),
): PageFetcher {
  return mock(impl) as unknown as PageFetcher;
}

function service(
  overrides: {
    client?: ResponsesClient;
    searxng?: SearxngClient;
    fetcher?: PageFetcher;
    now?: () => number;
  } = {},
) {
  return new DeepResearchService(
    overrides.client ?? fakeClient(),
    overrides.searxng ??
      fakeSearxng([[hit('https://a.com/1')], [hit('https://b.com/2')]]),
    overrides.fetcher ?? fakeFetcher(),
    overrides.now ?? Date.now,
  );
}

function searchedQueries(searxng: SearxngClient): string[] {
  return searchCalls(searxng).map((call) => call[0] as string);
}

function searchCalls(searxng: SearxngClient): unknown[][] {
  return (searxng.searchDetailed as unknown as ReturnType<typeof mock>).mock
    .calls;
}

function fetchedUrls(fetcher: PageFetcher): string[] {
  return (fetcher as unknown as ReturnType<typeof mock>).mock.calls.map(
    (call) => call[0] as string,
  );
}

/** A relevant extraction that hands the frontier one new query every time. */
function extractionWithFollowUps(): () => unknown {
  let seq = 0;
  return () => ({
    ...relevantExtraction,
    followUpQueries: [`pista ${seq++}`],
  });
}

/** Distinct hits per query, spread over enough domains to clear MAX_PER_DOMAIN. */
function hitsPerQuery(count: number): (query: string) => SearchHit[] {
  return (query) => {
    const slug = query.replace(/\W+/g, '-');
    return Array.from({ length: count }, (_, index) =>
      hit(`https://d${index}.com/${slug}`),
    );
  };
}

describe('DeepResearchService pipeline', () => {
  it('plans, searches, reads, extracts, analyzes and synthesizes a report', async () => {
    const result = await service().run({ query: 'estado da arte de X' });

    expect(result.report).toContain('achei isso');
    expect(result.sources).toHaveLength(2);
    expect(result.stats.rounds).toBe(1);
    expect(result.stats.relevantSources).toBe(2);
    expect(result.stats.maxDepth).toBe(0);
  });

  it('searches every sub-query the plan produced', async () => {
    const searxng = fakeSearxng(() => [hit('https://a.com/1')]);

    await service({ searxng }).run({ query: 'x' });

    expect(searchedQueries(searxng)).toEqual(['x definicao', 'x dados 2026']);
  });

  it('numbers sources contiguously from 1 so citations always resolve', async () => {
    const searxng = fakeSearxng([
      [hit('https://a.com/1'), hit('https://b.com/2'), hit('https://c.com/3')],
    ]);
    // The middle source is judged irrelevant and must not leave a gap.
    let call = 0;
    const client = fakeClient({
      extraction: () =>
        call++ === 1 ? irrelevantExtraction : relevantExtraction,
    });

    const result = await service({ client, searxng }).run({ query: 'x' });

    expect(result.sources.map((s) => s.index)).toEqual([1, 2]);
  });

  it('drops irrelevant sources from the report entirely', async () => {
    const client = fakeClient({ extraction: irrelevantExtraction });

    const result = await service({ client }).run({ query: 'x' });

    expect(result.sources).toEqual([]);
    expect(result.stats.relevantSources).toBe(0);
  });

  it('carries each source url, title and published date into the source list', async () => {
    const searxng = fakeSearxng([[hit('https://a.com/1')]]);
    const fetcher = fakeFetcher(async () => page('texto', 'Titulo Real'));

    const result = await service({ searxng, fetcher }).run({ query: 'x' });

    expect(result.sources[0]).toEqual({
      index: 1,
      url: 'https://a.com/1',
      title: 'Titulo Real',
      publishedDate: '2026-01-15',
    });
  });

  it('does not read the same url twice across rounds', async () => {
    const fetcher = fakeFetcher();
    const searxng = fakeSearxng(() => [hit('https://same.com/p')]);
    const client = fakeClient({ extraction: extractionWithFollowUps() });

    await service({ client, searxng, fetcher }).run({ query: 'x' });

    expect(fetchedUrls(fetcher)).toEqual(['https://same.com/p']);
  });
});

describe('DeepResearchService triage', () => {
  it('reads only the candidates triage picked, not the whole ranked pool', async () => {
    const searxng = fakeSearxng([
      [hit('https://a.com/1'), hit('https://b.com/2'), hit('https://c.com/3')],
    ]);
    const client = fakeClient({
      triage: {
        picks: [
          { url: 'https://c.com/3', priority: 'alta', reason: 'primaria' },
        ],
      },
    });
    const fetcher = fakeFetcher();

    await service({ client, searxng, fetcher }).run({ query: 'x' });

    expect(fetchedUrls(fetcher)).toEqual(['https://c.com/3']);
  });

  it('tells the next round which gaps the last reflection found', async () => {
    // The gaps used to be printed in the thread and dropped, so triage kept
    // picking pages that reinforced what was already covered.
    const triageInputs: string[] = [];
    const searxng = fakeSearxng(hitsPerQuery(2));
    const client = fakeClient({
      reflection: [
        {
          sufficient: false,
          gaps: ['nenhuma fonte sobre spawn de Brotato'],
          followUpQueries: ['Brotato spawn waves'],
        },
      ],
      triage: (urls: any[]) => {
        return {
          picks: urls.map((url: any) => ({
            url,
            priority: 'media',
            reason: 'serve',
          })),
        };
      },
    });
    const spy = client.structured as unknown as ReturnType<typeof mock>;

    await service({ client, searxng }).run({ query: 'x' });

    for (const call of spy.mock.calls) {
      const options = call[0] as {
        phase?: string;
        input: { content: string }[];
      };
      if (options.phase?.startsWith('research_triage')) {
        triageInputs.push(options.input[0]!.content);
      }
    }
    expect(triageInputs[0]).not.toContain('Brotato');
    expect(triageInputs[1]).toContain('nenhuma fonte sobre spawn de Brotato');
  });

  it('reads the high priority picks before the merely useful ones', async () => {
    const searxng = fakeSearxng([
      [hit('https://a.com/1'), hit('https://b.com/2')],
    ]);
    const client = fakeClient({
      triage: {
        picks: [
          { url: 'https://a.com/1', priority: 'media', reason: 'ok' },
          { url: 'https://b.com/2', priority: 'alta', reason: 'decisiva' },
        ],
      },
    });
    const fetcher = fakeFetcher();

    await service({ client, searxng, fetcher }).run({ query: 'x' });

    expect(fetchedUrls(fetcher)[0]).toBe('https://b.com/2');
  });

  it('ignores picks pointing at urls that were never candidates', async () => {
    const searxng = fakeSearxng([[hit('https://a.com/1')]]);
    const client = fakeClient({
      triage: {
        picks: [
          { url: 'https://inventada.com/x', priority: 'alta', reason: 'nao' },
          { url: 'https://a.com/1', priority: 'media', reason: 'sim' },
        ],
      },
    });
    const fetcher = fakeFetcher();

    await service({ client, searxng, fetcher }).run({ query: 'x' });

    expect(fetchedUrls(fetcher)).toEqual(['https://a.com/1']);
  });

  it('falls back to the ranked order when the triage call fails', async () => {
    const searxng = fakeSearxng([[hit('https://a.com/1')]]);
    const client = fakeClient({
      fail: (phase) => phase.startsWith('research_triage'),
    });
    const fetcher = fakeFetcher();

    const result = await service({ client, searxng, fetcher }).run({
      query: 'x',
    });

    expect(fetchedUrls(fetcher)).toEqual(['https://a.com/1']);
    expect(result.sources).toHaveLength(1);
  });
});

describe('DeepResearchService degraded search backend', () => {
  it('says the search engine is failing instead of staying quiet about it', async () => {
    const events: [string, string][] = [];
    const searxng = brokenSearxng('O SearXNG respondeu 429 Too Many Requests');

    await service({ searxng }).run({
      query: 'x',
      onProgress: (stage, message) => events.push([stage, message]),
    });

    const failure = events.find(([stage]) => stage === 'search_failed');
    expect(failure?.[1]).toContain('429');
  });

  it('blames the search engine, not the topic, when every search errored', async () => {
    const searxng = brokenSearxng('SearXNG fora do ar');

    const result = await service({ searxng }).run({ query: 'tema legítimo' });

    expect(result.report).toMatch(/busca/i);
    expect(result.report).not.toMatch(/reformular o tema/i);
  });

  it('still blames the topic when the searches worked and found nothing', async () => {
    const result = await service({ searxng: fakeSearxng(() => []) }).run({
      query: 'assunto obscuro',
    });

    expect(result.report).toMatch(/reformular o tema/i);
  });
});

describe('sanitizeQuery', () => {
  it('strips the quotes the prompt promises are stripped', () => {
    expect(sanitizeQuery('"Semi-Adjusting BSP-tree" 4250 moving objects')).toBe(
      'Semi-Adjusting BSP-tree 4250 moving objects',
    );
    expect(sanitizeQuery('«Brotato» (wave scaling) [2026]')).toBe(
      'Brotato wave scaling 2026',
    );
  });

  it('keeps an apostrophe inside a word but drops a quoting one', () => {
    expect(sanitizeQuery("Godot's collision layers")).toBe(
      "Godot's collision layers",
    );
    expect(sanitizeQuery("'bullet heaven' scaling")).toBe(
      'bullet heaven scaling',
    );
  });

  it('drops a url pasted into a query', () => {
    expect(
      sanitizeQuery('MultiMeshInstance2D docs https://docs.godotengine.org/pt'),
    ).toBe('MultiMeshInstance2D docs');
  });

  it('still strips the engine operators it always did', () => {
    expect(
      sanitizeQuery('open weights site:opensource.org OR filetype:pdf'),
    ).toBe('open weights');
  });
});

describe('relaxQuery', () => {
  it('drops stopwords before anything that carries meaning', () => {
    expect(
      relaxQuery('qual o impacto do escalonamento de ondas em Brotato'),
    ).toBe('impacto escalonamento ondas Brotato');
  });

  it('keeps the proper nouns when it has to cut down to the ceiling', () => {
    // The old head-slice kept "Godot PhysicsServer2D performance direct usage
    // vs" — six words, two of them dead weight, and the anchor "2D" gone.
    expect(
      relaxQuery(
        'Godot PhysicsServer2D performance direct usage vs nodes benchmark 2D',
      ),
    ).toBe('Godot PhysicsServer2D performance direct usage 2D');
  });

  it('preserves the original word order of whatever it kept', () => {
    expect(
      relaxQuery('spawn pacing waves enemy Brotato Halls Torment director'),
    ).toBe('spawn pacing waves Brotato Halls Torment');
  });

  it('gives back nothing when the query was only stopwords', () => {
    expect(relaxQuery('o que é o de a')).toBe('');
  });
});

describe('DeepResearchService query hygiene', () => {
  it('strips search operators the model keeps inventing', async () => {
    const searxng = fakeSearxng(hitsPerQuery(1));
    const client = fakeClient({
      plan: {
        ...plan,
        subQueries: [
          {
            query:
              'definição open weights site:opensource.org OR site:linuxfoundation.org',
            facetId: 'base',
            angle: 'definicao',
            rationale: 'base',
          },
        ],
      },
    });

    await service({ client, searxng }).run({ query: 'x' });

    const queries = searchedQueries(searxng);
    expect(queries).toEqual(['definição open weights']);
  });

  it('retries a query that came back empty with fewer terms', async () => {
    // SearXNG ANDs every term, so a nine-word keyword string matches nothing
    // while its head does.
    const long =
      'Vampire Survivors spawn director wave table enemy density scaling';
    const searxng = fakeSearxng((query) =>
      query === long ? [] : [hit('https://a.com/1')],
    );
    const client = fakeClient({
      plan: {
        ...plan,
        subQueries: [
          {
            query: long,
            facetId: 'base',
            angle: 'dados',
            rationale: 'dados',
          },
        ],
      },
    });

    const result = await service({ client, searxng }).run({ query: 'x' });

    const queries = searchedQueries(searxng);
    expect(queries[0]).toBe(long);
    expect(queries[1]).toBe('Vampire Survivors spawn director wave table');
    expect(result.sources).toHaveLength(1);
  });

  it('does not retry a short query that legitimately found nothing', async () => {
    const searxng = fakeSearxng(() => []);
    const client = fakeClient({
      plan: {
        ...plan,
        subQueries: [
          {
            query: 'assunto obscuro',
            facetId: 'base',
            angle: 'definicao',
            rationale: 'base',
          },
        ],
      },
    });

    await service({ client, searxng }).run({ query: 'x' });

    expect(searchedQueries(searxng)).toEqual(['assunto obscuro']);
  });

  it('does not narrow the search to one language', async () => {
    // The planner is told to write English queries for topics whose literature
    // is in English; filtering those to pt-BR is how they came back empty.
    const searxng = fakeSearxng(hitsPerQuery(1));

    await service({ searxng }).run({ query: 'x' });

    for (const call of searchCalls(searxng)) {
      expect(
        (call[1] as { language?: string } | undefined)?.language,
      ).toBeUndefined();
    }
  });

  it('charges the retry to the search budget instead of running it for free', async () => {
    const long = 'Godot bullet heaven wave scaling director benchmark 2026';
    const searxng = fakeSearxng((query) =>
      query === long ? [] : [hit('https://a.com/1')],
    );
    const client = fakeClient({
      plan: {
        ...plan,
        subQueries: [
          { query: long, facetId: 'base', angle: 'dados', rationale: 'dados' },
        ],
      },
    });

    const result = await service({ client, searxng }).run({ query: 'x' });

    expect(searchedQueries(searxng)).toHaveLength(2);
    expect(result.stats.searches).toBe(2);
  });

  it('never fetches a url the reader cannot parse, but keeps pdfs', async () => {
    const searxng = fakeSearxng([
      [
        hit('https://gov.br/planilha.xlsx'),
        hit('https://nist.gov/report.pdf'),
        hit('https://a.com/artigo'),
      ],
    ]);
    const fetcher = fakeFetcher();

    await service({ searxng, fetcher }).run({ query: 'x' });

    expect(fetchedUrls(fetcher)).toEqual([
      'https://nist.gov/report.pdf',
      'https://a.com/artigo',
    ]);
  });
});

describe('DeepResearchService recursive follow-ups', () => {
  it('searches the queries a source extraction proposed', async () => {
    const searxng = fakeSearxng(hitsPerQuery(1));
    const client = fakeClient({ extraction: extractionWithFollowUps() });

    await service({ client, searxng }).run({ query: 'x' });

    expect(searchedQueries(searxng)).toContain('pista 0');
  });

  it('never searches the same query twice, however it was proposed', async () => {
    const searxng = fakeSearxng(hitsPerQuery(1));
    const client = fakeClient({
      extraction: {
        ...relevantExtraction,
        // Every source asks for the same follow-up, and one repeats the plan.
        followUpQueries: ['x definicao', 'pista unica'],
      },
    });

    await service({ client, searxng }).run({ query: 'x' });

    const queries = searchedQueries(searxng);
    expect(queries).toEqual([...new Set(queries)]);
    expect(queries.filter((q) => q === 'pista unica')).toHaveLength(1);
  });

  it('stops recursing past the depth limit', async () => {
    const searxng = fakeSearxng(hitsPerQuery(1));
    const client = fakeClient({
      extraction: extractionWithFollowUps(),
      reflection: [{ sufficient: false, gaps: [], followUpQueries: [] }],
    });

    const result = await service({ client, searxng }).run({ query: 'x' });

    expect(result.stats.maxDepth).toBe(MAX_FRONTIER_DEPTH);
    expect(result.stats.rounds).toBe(MAX_FRONTIER_DEPTH + 1);
  });

  it('counts a source follow-up as one level deeper than the plan', async () => {
    const searxng = fakeSearxng(hitsPerQuery(1));
    const client = fakeClient({
      extraction: {
        ...relevantExtraction,
        followUpQueries: ['pista unica'],
      },
    });

    const result = await service({ client, searxng }).run({ query: 'x' });

    expect(result.stats.maxDepth).toBe(1);
  });
});

describe('DeepResearchService depth floor', () => {
  it('keeps researching when reflection is satisfied but the floor is not met', async () => {
    const searxng = fakeSearxng(hitsPerQuery(1));
    const client = fakeClient({
      extraction: extractionWithFollowUps(),
      reflection: [{ sufficient: true, gaps: [], followUpQueries: [] }],
    });

    const result = await service({ client, searxng }).run({ query: 'x' });

    expect(result.stats.rounds).toBeGreaterThan(1);
    expect(result.stats.relevantSources).toBeLessThan(MIN_RELEVANT_SOURCES);
  });

  it('stops once reflection is satisfied and the floor is met', async () => {
    const searxng = fakeSearxng(hitsPerQuery(12));
    const client = fakeClient({
      extraction: extractionWithFollowUps(),
      reflection: [{ sufficient: true, gaps: [], followUpQueries: [] }],
    });

    const result = await service({ client, searxng }).run({ query: 'x' });

    expect(result.stats.rounds).toBe(2);
    expect(result.stats.relevantSources).toBeGreaterThanOrEqual(
      MIN_RELEVANT_SOURCES,
    );
  });

  it('stops when the frontier runs dry even with the floor unmet', async () => {
    const client = fakeClient({
      reflection: [
        { sufficient: false, gaps: ['falta tudo'], followUpQueries: [] },
      ],
    });

    const result = await service({ client }).run({ query: 'x' });

    expect(result.stats.rounds).toBe(1);
    expect(result.report).toBeTruthy();
  });

  it('follows the queries reflection asked for', async () => {
    const searxng = fakeSearxng(hitsPerQuery(1));
    const client = fakeClient({
      reflection: [
        {
          sufficient: false,
          gaps: ['falta numero'],
          followUpQueries: ['x numeros'],
        },
        { sufficient: true, gaps: [], followUpQueries: [] },
      ],
    });

    const result = await service({ client, searxng }).run({ query: 'x' });

    expect(searchedQueries(searxng)).toContain('x numeros');
    expect(result.stats.rounds).toBe(2);
  });

  it('writes the report anyway when reflection itself fails', async () => {
    const client = fakeClient({
      fail: (phase) => phase.startsWith('research_reflect'),
    });

    const result = await service({ client }).run({ query: 'x' });

    expect(result.report).toBeTruthy();
    expect(result.sources.length).toBeGreaterThan(0);
  });
});

describe('DeepResearchService analysis', () => {
  it('hands the synthesis step the analysis it produced', async () => {
    const client = fakeClient();

    await service({ client }).run({ query: 'x' });

    const synthesisInput = (client.create as unknown as ReturnType<typeof mock>)
      .mock.calls[0]?.[0] as { input: { content: string }[] };
    expect(synthesisInput.input[0]!.content).toContain('<analise>');
    expect(synthesisInput.input[0]!.content).toContain('O que é X');
  });

  it('still writes the report when the analysis call fails', async () => {
    const client = fakeClient({
      fail: (phase) => phase === 'research_analyze',
    });

    const result = await service({ client }).run({ query: 'x' });

    expect(result.report).toBeTruthy();
    const synthesisInput = (client.create as unknown as ReturnType<typeof mock>)
      .mock.calls[0]?.[0] as { input: { content: string }[] };
    expect(synthesisInput.input[0]!.content).not.toContain('<analise>');
  });

  it('does not analyze when no source was usable', async () => {
    const client = fakeClient({ extraction: irrelevantExtraction });

    await service({ client }).run({ query: 'x' });

    const phases = (
      client.structured as unknown as ReturnType<typeof mock>
    ).mock.calls.map((call) => (call[0] as { phase?: string }).phase);
    expect(phases).not.toContain('research_analyze');
  });
});

describe('DeepResearchService resilience', () => {
  it('keeps going when one sub-query search fails', async () => {
    const searxng = {
      search: mock(async (query: string) => {
        if (query === 'x definicao') throw new Error('searxng 503');
        return [hit('https://b.com/2')];
      }),
    } as unknown as SearxngClient;

    const result = await service({ searxng }).run({ query: 'x' });

    expect(result.sources).toHaveLength(1);
  });

  it('skips a page it cannot fetch instead of failing the job', async () => {
    const searxng = fakeSearxng([
      [hit('https://ok.com/1'), hit('https://bad.com/2')],
    ]);
    const fetcher = fakeFetcher(async (url) => {
      if (url.includes('bad')) throw new FetchPageError('404');
      return page('conteudo bom');
    });

    const result = await service({ searxng, fetcher }).run({ query: 'x' });

    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]?.url).toBe('https://ok.com/1');
  });

  it('skips a page whose body came back empty', async () => {
    const searxng = fakeSearxng([[hit('https://empty.com/1')]]);
    const fetcher = fakeFetcher(async () => page('   '));

    const result = await service({ searxng, fetcher }).run({ query: 'x' });

    expect(result.sources).toEqual([]);
  });

  it('skips a source whose extraction call fails', async () => {
    const searxng = fakeSearxng([[hit('https://a.com/1')]]);
    const client = fakeClient({
      fail: (phase) => phase.startsWith('research_extract'),
    });

    const result = await service({ client, searxng }).run({ query: 'x' });

    expect(result.sources).toEqual([]);
  });

  it('returns an honest report when no source was usable at all', async () => {
    const searxng = fakeSearxng([[]]);

    const result = await service({ searxng }).run({ query: 'assunto obscuro' });

    expect(result.report).toContain('assunto obscuro');
    expect(result.report.toLowerCase()).toContain('sem fonte');
    expect(result.sources).toEqual([]);
  });

  it('propagates a non-fetch error rather than silently swallowing a bug', async () => {
    const searxng = fakeSearxng([[hit('https://a.com/1')]]);
    const fetcher = fakeFetcher(async () => {
      throw new TypeError('bug de programacao');
    });

    expect(service({ searxng, fetcher }).run({ query: 'x' })).rejects.toThrow(
      'bug de programacao',
    );
  });
});

describe('DeepResearchService budgets', () => {
  function clockThatJumps(stepMs: number): () => number {
    let current = 0;
    return () => {
      const value = current;
      current += stepMs;
      return value;
    };
  }

  it('stops researching and reports when the deadline passes', async () => {
    const client = fakeClient({
      extraction: extractionWithFollowUps(),
      reflection: [{ sufficient: false, gaps: ['g'], followUpQueries: [] }],
    });

    const result = await service({
      client,
      searxng: fakeSearxng(hitsPerQuery(1)),
      now: clockThatJumps(400_000),
    }).run({ query: 'x' });

    expect(result.stats.truncatedByBudget).toBe(true);
    expect(result.report).toBeTruthy();
  });

  it('does not count a round that a budget guard aborted before any work', async () => {
    const client = fakeClient({
      extraction: extractionWithFollowUps(),
      reflection: [{ sufficient: false, gaps: ['g'], followUpQueries: [] }],
    });

    const result = await service({
      client,
      searxng: fakeSearxng(hitsPerQuery(1)),
      // Round 1 runs, then the clock is past the deadline at the top of round 2.
      now: clockThatJumps(400_000),
    }).run({ query: 'x' });

    expect(result.stats.truncatedByBudget).toBe(true);
    expect(result.stats.rounds).toBe(1);
  });

  it('still analyzes and synthesizes after the loop is cut short', async () => {
    const client = fakeClient({
      extraction: extractionWithFollowUps(),
      reflection: [{ sufficient: false, gaps: ['g'], followUpQueries: [] }],
    });

    await service({
      client,
      searxng: fakeSearxng(hitsPerQuery(1)),
      now: clockThatJumps(400_000),
    }).run({ query: 'x' });

    const phases = (
      client.structured as unknown as ReturnType<typeof mock>
    ).mock.calls.map((call) => (call[0] as { phase?: string }).phase);
    expect(phases).toContain('research_analyze');
    expect(
      client.create as unknown as ReturnType<typeof mock>,
    ).toHaveBeenCalled();
  });

  it('tells the synthesis step that the research was cut short', async () => {
    const client = fakeClient({
      extraction: extractionWithFollowUps(),
      reflection: [{ sufficient: false, gaps: ['g'], followUpQueries: [] }],
    });

    await service({
      client,
      searxng: fakeSearxng(hitsPerQuery(1)),
      now: clockThatJumps(400_000),
    }).run({ query: 'x' });

    const synthesisInput = (client.create as unknown as ReturnType<typeof mock>)
      .mock.calls[0]?.[0] as { input: { content: string }[] };
    expect(synthesisInput.input[0]!.content).toContain('aviso_de_limite');
  });

  it('reports stats for searches and pages actually used', async () => {
    const searxng = fakeSearxng([
      [hit('https://a.com/1')],
      [hit('https://b.com/2')],
    ]);

    const result = await service({ searxng }).run({ query: 'x' });

    expect(result.stats.searches).toBe(2);
    expect(result.stats.fetched).toBe(2);
    expect(result.stats.durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe('DeepResearchService progress', () => {
  it('reports each stage so the bot can post progress in the thread', async () => {
    const stages: string[] = [];

    await service().run({
      query: 'x',
      onProgress: (stage) => stages.push(stage),
    });

    expect(stages).toContain('plan');
    expect(stages).toContain('search');
    expect(stages).toContain('sift');
    expect(stages).toContain('triage');
    expect(stages).toContain('read');
    expect(stages).toContain('extract');
    expect(stages).toContain('analyze');
    expect(stages).toContain('synthesize');
  });

  it('says which pages it failed to read and why', async () => {
    const events: [string, string][] = [];
    const searxng = fakeSearxng([
      [hit('https://ok.com/1'), hit('https://bad.com/2')],
    ]);
    const fetcher = fakeFetcher(async (url) => {
      if (url.includes('bad')) throw new FetchPageError('respondeu 401');
      return page('conteudo bom');
    });

    await service({ searxng, fetcher }).run({
      query: 'x',
      onProgress: (stage, message) => events.push([stage, message]),
    });

    const failure = events.find(([stage]) => stage === 'read_failed');
    expect(failure?.[1]).toContain('bad.com');
    expect(failure?.[1]).toContain('401');
  });

  it('separates "found nothing" from "already read it all" before triage', async () => {
    // A round showing "0 de 0" used to be unreadable: engines down, everything
    // already visited and a topic with no coverage all looked the same.
    const events: [string, string][] = [];
    const searxng = fakeSearxng(() => [hit('https://same.com/p')]);
    const client = fakeClient({
      reflection: [{ sufficient: false, gaps: [], followUpQueries: ['pista'] }],
    });

    await service({ client, searxng }).run({
      query: 'x',
      onProgress: (stage, message) => events.push([stage, message]),
    });

    const sifts = events.filter(([stage]) => stage === 'sift');
    expect(sifts.at(-1)?.[1]).toMatch(/j[áa] lid[ao]/i);
  });

  it('names the engines that were down instead of blaming the topic', async () => {
    const events: [string, string][] = [];
    const searxng = fakeSearxng(() => [], ['google', 'duckduckgo']);

    await service({ searxng }).run({
      query: 'x',
      onProgress: (stage, message) => events.push([stage, message]),
    });

    const sift = events.find(([stage]) => stage === 'sift');
    expect(sift?.[1]).toContain('google');
    expect(sift?.[1]).toContain('duckduckgo');
  });

  it('says when a lead was dropped for being past the depth limit', async () => {
    const events: [string, string][] = [];
    const client = fakeClient({
      extraction: extractionWithFollowUps(),
      reflection: [{ sufficient: false, gaps: [], followUpQueries: [] }],
    });

    await service({ client, searxng: fakeSearxng(hitsPerQuery(1)) }).run({
      query: 'x',
      onProgress: (stage, message) => events.push([stage, message]),
    });

    const follow = events.filter(([stage]) => stage === 'follow');
    expect(follow.at(-1)?.[1]).toMatch(/profundidade/i);
  });

  it('announces the new threads a source opened', async () => {
    const events: [string, string][] = [];
    const client = fakeClient({ extraction: extractionWithFollowUps() });

    await service({ client, searxng: fakeSearxng(hitsPerQuery(1)) }).run({
      query: 'x',
      onProgress: (stage, message) => events.push([stage, message]),
    });

    const follow = events.find(([stage]) => stage === 'follow');
    expect(follow?.[1]).toContain('pista 0');
  });

  it('lists the planned sub-queries in the plan progress message', async () => {
    const messages: string[] = [];

    await service().run({
      query: 'x',
      onProgress: (_stage, message) => messages.push(message),
    });

    expect(messages[0]).toContain('x definicao');
    expect(messages[0]).toContain('x dados 2026');
  });

  it('works without a progress reporter', async () => {
    const result = await service().run({ query: 'x' });

    expect(result.report).toBeTruthy();
  });
});
