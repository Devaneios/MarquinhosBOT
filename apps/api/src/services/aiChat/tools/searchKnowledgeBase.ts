import { KnowledgeBaseClient } from 'services/aiChat/KnowledgeBaseClient';
import type { AgentTool } from 'services/aiChat/tools/types';

const NOT_FOUND_MESSAGE =
  'Não encontrei nada nos registros do servidor sobre isso.';

export interface SearchKnowledgeBaseDeps {
  client: KnowledgeBaseClient;
}

// Fala com o serviço local de RAG do devaneios-chats (fora deste repo — ver
// KnowledgeBaseClient). Nunca falha o tool call: se o serviço estiver fora do
// ar ou não achar nada, devolve uma mensagem de "não encontrei", igual a
// qualquer busca sem resultado.
export function createSearchKnowledgeBaseTool(
  deps?: Partial<SearchKnowledgeBaseDeps>,
): AgentTool {
  const client = deps?.client ?? new KnowledgeBaseClient();

  return {
    name: 'search_knowledge_base',
    description:
      'Busca no histórico de chat do servidor Devaneios e nas notas curadas de lore (pessoas, in-jokes, cargos, vocabulário do servidor). Use para perguntas sobre membros, eventos ou vocabulário específico do servidor que não estejam no seu código-fonte.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'A pergunta ou termo de busca, em português, ex: "quem é o zegabr" ou "o que significa fechar a diária".',
        },
      },
      required: ['query'],
    },
    async execute(args) {
      const query = typeof args.query === 'string' ? args.query.trim() : '';
      if (!query) return NOT_FOUND_MESSAGE;

      const result = await client.search(query);
      if (!result.found || !result.context) return NOT_FOUND_MESSAGE;

      return result.context;
    },
  };
}

export const searchKnowledgeBaseTool = createSearchKnowledgeBaseTool();
