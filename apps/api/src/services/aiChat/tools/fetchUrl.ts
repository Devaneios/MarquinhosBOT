import type { AgentTool } from 'services/aiChat/tools/types';
import {
  createPageFetcher,
  FetchPageError,
  type FetchPageDeps,
} from 'services/aiChat/web/fetchPage';

export {
  MAX_BODY_BYTES,
  MAX_LINKS,
  MAX_REDIRECTS,
  type FetchFn,
  type LookupFn,
} from 'services/aiChat/web/fetchPage';

export const MAX_TEXT_CHARS = 3000;

function capText(text: string): string {
  if (text.length <= MAX_TEXT_CHARS) return text;
  return `${text.slice(0, MAX_TEXT_CHARS)}\n\n[conteúdo truncado]`;
}

export function createFetchUrlTool(deps?: Partial<FetchPageDeps>): AgentTool {
  const fetchPage = createPageFetcher(deps);

  return {
    name: 'fetch_url',
    description:
      'Busca o conteúdo de uma URL pública (só https) e devolve o texto da página ou a lista de links dela. Use mode "links" para navegar entre páginas seguindo links, e mode "text" para ler o conteúdo. Para descobrir páginas a partir de um assunto em vez de uma URL conhecida, use search_web primeiro.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description:
            'URL https completa, ex: https://pt.wikipedia.org/wiki/Recife',
        },
        mode: {
          type: 'string',
          enum: ['text', 'links'],
          description:
            '"text" devolve o texto da página (padrão); "links" devolve os links do mesmo domínio, ideal para seguir de página em página.',
        },
      },
      required: ['url'],
    },
    async execute(args) {
      const rawUrl = String(args.url ?? '');
      const mode = args.mode === 'links' ? 'links' : 'text';

      try {
        const page = await fetchPage(rawUrl, { mode });

        if (mode === 'links') {
          if (page.links.length === 0) {
            return `Não encontrei nenhum link utilizável em "${page.finalUrl}".`;
          }
          const header = `${page.links.length} links em ${page.finalUrl}:`;
          return [header, ...page.links].join('\n');
        }

        const capped = capText(page.content);
        if (page.truncated && !capped.includes('truncado')) {
          return `${capped}\n\n[conteúdo truncado]`;
        }
        return capped || `"${page.finalUrl}" respondeu vazio.`;
      } catch (error) {
        if (error instanceof FetchPageError) return error.message;
        return `Não consegui buscar "${rawUrl}": ${(error as Error).message}`;
      }
    },
  };
}

export const fetchUrlTool = createFetchUrlTool();
