import { describe, expect, it, mock } from 'bun:test';
import { createSearchKnowledgeBaseTool } from 'services/aiChat/tools/searchKnowledgeBase';
import type { AgentToolContext } from 'services/aiChat/tools/types';

const ctx: AgentToolContext = {
  containerId: 'c1',
  exec: async () => ({ stdout: '', stderr: '', exitCode: 0 }),
};

function fakeClient(search: (query: string) => Promise<unknown>) {
  return { search: mock(search) };
}

describe('searchKnowledgeBaseTool', () => {
  it('returns the recovered context when the search finds results', async () => {
    const client = fakeClient(async () => ({
      found: true,
      context: '[Canal: #kb-curada]\n**PESSOAS-02 · fazendeiro** ...',
      chunks: [],
    }));
    const tool = createSearchKnowledgeBaseTool({ client: client as never });

    const result = await tool.execute({ query: 'quem é o fazendeiro?' }, ctx);

    expect(result).toContain('PESSOAS-02 · fazendeiro');
    expect(client.search).toHaveBeenCalledWith('quem é o fazendeiro?');
  });

  it('returns a not-found message when nothing is found', async () => {
    const client = fakeClient(async () => ({
      found: false,
      context: '',
      chunks: [],
    }));
    const tool = createSearchKnowledgeBaseTool({ client: client as never });

    const result = await tool.execute({ query: 'qualquer coisa' }, ctx);

    expect(result.toLowerCase()).toContain('não encontrei');
  });

  it('returns a not-found message when query is missing/empty', async () => {
    const client = fakeClient(async () => ({
      found: false,
      context: '',
      chunks: [],
    }));
    const tool = createSearchKnowledgeBaseTool({ client: client as never });

    const result = await tool.execute({}, ctx);

    expect(result.toLowerCase()).toContain('não encontrei');
    expect(client.search).not.toHaveBeenCalled();
  });

  it('exposes the AgentTool shape (name/description/parameters)', () => {
    const tool = createSearchKnowledgeBaseTool();
    expect(tool.name).toBe('search_knowledge_base');
    expect(tool.description).toBeTruthy();
    expect(tool.parameters).toMatchObject({
      type: 'object',
      required: ['query'],
    });
  });
});
