const DEFAULT_BASE_URL =
  process.env.SEARXNG_URL ?? 'https://searxng.frois.net.br';
const SEARCH_TIMEOUT_MS = 12_000;
const DEFAULT_LIMIT = 10;
const USER_AGENT = 'MarquinhosBOT/1.0 (Discord bot; research agent)';

export class SearxngError extends Error {}

export interface SearchHit {
  url: string;
  title: string;
  snippet: string;
  engines: string[];
  score: number;
  publishedDate?: string;
}

export interface SearchOptions {
  language?: string;
  categories?: string;
  timeRange?: 'day' | 'week' | 'month' | 'year';
  limit?: number;
}

export interface SearchResponse {
  hits: SearchHit[];
  /** Engines that failed the query — captcha, timeout, rate limit. */
  unresponsiveEngines: string[];
}

export type SearxngFetchFn = (
  input: URL | string,
  init?: RequestInit,
) => Promise<Response>;

export interface SearxngClientDeps {
  fetchFn?: SearxngFetchFn;
  baseUrl?: string;
}

interface SearxngRawResult {
  url?: unknown;
  title?: unknown;
  content?: unknown;
  engines?: unknown;
  score?: unknown;
  publishedDate?: unknown;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isHttpUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * SearXNG reports failures as `[engine, reason]` pairs, but older versions and
 * some instances send a flat list of names. Only the name is worth surfacing.
 */
function parseUnresponsive(payload: {
  unresponsive_engines?: unknown;
}): string[] {
  if (!Array.isArray(payload.unresponsive_engines)) return [];
  const names: string[] = [];
  for (const entry of payload.unresponsive_engines) {
    const name = Array.isArray(entry) ? entry[0] : entry;
    if (typeof name === 'string' && name && !names.includes(name)) {
      names.push(name);
    }
  }
  return names;
}

export class SearxngClient {
  private readonly fetchFn: SearxngFetchFn;
  private readonly baseUrl: string;

  constructor(deps: SearxngClientDeps = {}) {
    this.fetchFn = deps.fetchFn ?? fetch;
    this.baseUrl = (deps.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  }

  async search(
    query: string,
    options: SearchOptions = {},
  ): Promise<SearchHit[]> {
    return (await this.searchDetailed(query, options)).hits;
  }

  /**
   * The same search, plus the engines that failed it. An instance whose engines
   * all got captcha'd answers 200 with an empty result list, so without this a
   * broken backend is indistinguishable from a topic nobody wrote about.
   */
  async searchDetailed(
    query: string,
    options: SearchOptions = {},
  ): Promise<SearchResponse> {
    const params = new URLSearchParams({ q: query, format: 'json' });
    if (options.language) params.set('language', options.language);
    if (options.categories) params.set('categories', options.categories);
    if (options.timeRange) params.set('time_range', options.timeRange);

    const url = `${this.baseUrl}/search?${params.toString()}`;

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method: 'GET',
        credentials: 'omit',
        headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
        signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
      });
    } catch (error) {
      if ((error as Error).name === 'TimeoutError') {
        throw new SearxngError(
          `A busca por "${query}" passou de ${SEARCH_TIMEOUT_MS / 1000}s e foi abortada.`,
        );
      }
      throw new SearxngError(
        `Não consegui falar com o SearXNG: ${(error as Error).message}`,
      );
    }

    if (!response.ok) {
      throw new SearxngError(
        `O SearXNG respondeu ${response.status} ${response.statusText} para "${query}".`,
      );
    }

    let payload: { results?: unknown; unresponsive_engines?: unknown };
    try {
      payload = (await response.json()) as {
        results?: unknown;
        unresponsive_engines?: unknown;
      };
    } catch {
      throw new SearxngError(
        `O SearXNG devolveu uma resposta que não é JSON para "${query}".`,
      );
    }

    const raw = Array.isArray(payload.results)
      ? (payload.results as SearxngRawResult[])
      : [];
    const limit = options.limit ?? DEFAULT_LIMIT;
    const seen = new Set<string>();
    const hits: SearchHit[] = [];

    for (const result of raw) {
      if (hits.length >= limit) break;
      const url = asString(result.url);
      if (!isHttpUrl(url) || seen.has(url)) continue;
      seen.add(url);

      const publishedDate = asString(result.publishedDate);
      hits.push({
        url,
        title: asString(result.title) || url,
        snippet: asString(result.content),
        engines: Array.isArray(result.engines)
          ? result.engines.filter(
              (engine): engine is string => typeof engine === 'string',
            )
          : [],
        score: typeof result.score === 'number' ? result.score : 0,
        ...(publishedDate ? { publishedDate } : {}),
      });
    }

    return { hits, unresponsiveEngines: parseUnresponsive(payload) };
  }
}
