import type { AgentTool } from 'services/aiChat/tools/types';
import {
  SearxngClient,
  SearxngError,
  type SearchHit,
  type SearchOptions,
} from 'services/aiChat/web/SearxngClient';

const MAX_RESULTS = 8;
const MAX_SNIPPET_CHARS = 240;
const TIME_RANGES = ['day', 'week', 'month', 'year'] as const;

export type SearchFn = (
  query: string,
  options?: SearchOptions,
) => Promise<SearchHit[]>;

export interface SearchWebDeps {
  search: SearchFn;
}

function parseTimeRange(value: unknown): SearchOptions['timeRange'] {
  return TIME_RANGES.find((range) => range === value);
}

export function formatSearchHits(hits: SearchHit[]): string {
  return hits
    .map((hit, index) => {
      const snippet = hit.snippet
        .replace(/\s+/g, ' ')
        .slice(0, MAX_SNIPPET_CHARS);
      const date = hit.publishedDate
        ? ` (${hit.publishedDate.slice(0, 10)})`
        : '';
      const lines = [`${index + 1}. ${hit.title}${date}`, `   ${hit.url}`];
      if (snippet) lines.push(`   ${snippet}`);
      return lines.join('\n');
    })
    .join('\n');
}

export function createSearchWebTool(deps?: Partial<SearchWebDeps>): AgentTool {
  const search =
    deps?.search ??
    ((query: string, options?: SearchOptions) =>
      new SearxngClient().search(query, options));

  return {
    name: 'search_web',
    description:
      'Busca na web via SearXNG e devolve uma lista de resultados (título, URL e resumo). Use quando você precisa descobrir páginas sobre um assunto e ainda não tem a URL; depois use fetch_url para ler o conteúdo dos resultados que interessarem.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Termos de busca, como você digitaria num buscador. Prefira consultas específicas a perguntas longas.',
        },
        timeRange: {
          type: 'string',
          enum: [...TIME_RANGES],
          description:
            'Opcional. Restringe os resultados por recência — use quando o assunto for atual (notícias, versões recentes).',
        },
      },
      required: ['query'],
    },
    async execute(args) {
      const query = String(args.query ?? '').trim();
      if (!query) {
        return 'Preciso de termos de busca não vazios para fazer a busca.';
      }

      const timeRange = parseTimeRange(args.timeRange);

      try {
        const hits = await search(query, {
          limit: MAX_RESULTS,
          ...(timeRange ? { timeRange } : {}),
        });

        if (hits.length === 0) {
          return `Nenhum resultado para "${query}".`;
        }

        return `${hits.length} resultados para "${query}":\n${formatSearchHits(hits)}`;
      } catch (error) {
        if (error instanceof SearxngError) return error.message;
        return `A busca por "${query}" falhou: ${(error as Error).message}`;
      }
    },
  };
}

export const searchWebTool = createSearchWebTool();
