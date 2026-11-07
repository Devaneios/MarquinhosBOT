import { Injectable } from '@nestjs/common';
import { logger } from 'common/logging/logger';
import { z } from 'zod';

export interface KnowledgeBaseConfig {
  knowledgeBaseUrl?: string;
  knowledgeBaseApiKey?: string;
}

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
@Injectable()
export class KnowledgeBaseClient {
  constructor(
    private readonly fetchFn: typeof fetch = fetch,
    private readonly config: KnowledgeBaseConfig = {},
  ) {}

  async search(query: string): Promise<KnowledgeBaseSearchResult> {
    const baseUrl = this.config.knowledgeBaseUrl;
    if (!baseUrl) return NOT_FOUND;

    const controller = new globalThis.AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (this.config.knowledgeBaseApiKey) {
        headers.Authorization = `Bearer ${this.config.knowledgeBaseApiKey}`;
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
