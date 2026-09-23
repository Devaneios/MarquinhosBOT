import { logger } from 'utils/logger';
import { z } from 'zod';

const REQUEST_TIMEOUT_MS = 4000;

const knowledgeBaseChunkSchema = z.object({
  canal: z.string(),
  autores: z.array(z.string()),
  texto: z.string(),
});

export type KnowledgeBaseChunk = z.infer<typeof knowledgeBaseChunkSchema>;

export interface KnowledgeBaseSearchResult {
  found: boolean;
  context: string;
  chunks: KnowledgeBaseChunk[];
}

const NOT_FOUND: KnowledgeBaseSearchResult = {
  found: false,
  context: '',
  chunks: [],
};

const knowledgeBaseSearchResultSchema = z.object({
  found: z.boolean(),
  context: z.string(),
  chunks: z.array(knowledgeBaseChunkSchema),
});

// Cliente fino para o serviço local de RAG do devaneios-chats — nunca lança:
// qualquer falha (serviço fora do ar, timeout, resposta malformada) vira
// "not found", porque isso é um enriquecimento opcional do prompt, não deve
// derrubar a resposta do bot.
export class KnowledgeBaseClient {
  constructor(private fetchFn: typeof fetch = fetch) {}

  async search(query: string): Promise<KnowledgeBaseSearchResult> {
    const baseUrl = process.env.KNOWLEDGE_BASE_URL;
    if (!baseUrl) return NOT_FOUND;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (process.env.KNOWLEDGE_BASE_API_KEY) {
        headers.Authorization = `Bearer ${process.env.KNOWLEDGE_BASE_API_KEY}`;
      }

      const response = await this.fetchFn(`${baseUrl}/search`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query }),
        signal: controller.signal,
      });

      if (!response.ok) return NOT_FOUND;

      const result = knowledgeBaseSearchResultSchema.safeParse(
        await response.json(),
      );
      if (!result.success) return NOT_FOUND;

      return result.data;
    } catch (error) {
      logger.warn('knowledge_base.search.failed', { error });
      return NOT_FOUND;
    } finally {
      clearTimeout(timeout);
    }
  }
}
