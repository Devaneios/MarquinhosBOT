import { describe, expect, it, mock } from 'bun:test';
import { createSearchWebTool } from 'services/aiChat/tools/searchWeb';
import type { AgentToolContext } from 'services/aiChat/tools/types';
import {
  SearxngError,
  type SearchHit,
  type SearchOptions,
} from 'services/aiChat/web/SearxngClient';

const ctx: AgentToolContext = {
  containerId: 'c1',
  exec: async () => ({ stdout: '', stderr: '', exitCode: 0 }),
};

function hit(overrides: Partial<SearchHit> = {}): SearchHit {
  return {
    url: 'https://pt.wikipedia.org/wiki/Recife',
    title: 'Recife',
    snippet: 'Capital de Pernambuco',
    engines: ['wikipedia'],
    score: 1,
    ...overrides,
  };
}

describe('searchWebTool', () => {
  it('returns numbered results with title, url and snippet', async () => {
    const search = mock(async () => [
      hit(),
      hit({ url: 'https://recife.pe.gov.br/', title: 'Prefeitura' }),
    ]);
    const tool = createSearchWebTool({ search });

    const result = await tool.execute({ query: 'recife' }, ctx);

    expect(search).toHaveBeenCalled();
    expect(result).toContain('Recife');
    expect(result).toContain('https://pt.wikipedia.org/wiki/Recife');
    expect(result).toContain('Capital de Pernambuco');
    expect(result).toContain('Prefeitura');
  });

  it('passes the query through to the client', async () => {
    const search = mock(async (_query: string, _options?: SearchOptions) => [
      hit(),
    ]);
    const tool = createSearchWebTool({ search });

    await tool.execute({ query: 'bun sqlite wal' }, ctx);

    expect(search.mock.calls[0]?.[0]).toBe('bun sqlite wal');
  });

  it('forwards an explicit time range so the model can ask for recent results', async () => {
    const search = mock(async (_query: string, _options?: SearchOptions) => [
      hit(),
    ]);
    const tool = createSearchWebTool({ search });

    await tool.execute({ query: 'eleicoes', timeRange: 'week' }, ctx);

    expect(search.mock.calls[0]?.[1]).toMatchObject({ timeRange: 'week' });
  });

  it('ignores an invalid time range instead of forwarding garbage', async () => {
    const search = mock(async (_query: string, _options?: SearchOptions) => [
      hit(),
    ]);
    const tool = createSearchWebTool({ search });

    await tool.execute({ query: 'x', timeRange: 'ontem' }, ctx);

    expect(search.mock.calls[0]?.[1]?.timeRange).toBeUndefined();
  });

  it('rejects an empty query without calling the client', async () => {
    const search = mock(async (_query: string, _options?: SearchOptions) => [
      hit(),
    ]);
    const tool = createSearchWebTool({ search });

    const result = await tool.execute({ query: '   ' }, ctx);

    expect(search).not.toHaveBeenCalled();
    expect(result.toLowerCase()).toContain('busca');
  });

  it('says so when the search returns nothing', async () => {
    const search = mock(async () => []);
    const tool = createSearchWebTool({ search });

    const result = await tool.execute({ query: 'asdkjhasdkjh' }, ctx);

    expect(result.toLowerCase()).toContain('nenhum resultado');
  });

  it('surfaces a searxng failure as a readable message, not a throw', async () => {
    const search = mock(async () => {
      throw new SearxngError('O SearXNG respondeu 503 para "x".');
    });
    const tool = createSearchWebTool({ search });

    const result = await tool.execute({ query: 'x' }, ctx);

    expect(result).toContain('503');
  });

  it('does not leak an unexpected error stack into the model context', async () => {
    const search = mock(async () => {
      throw new Error('socket hang up');
    });
    const tool = createSearchWebTool({ search });

    const result = await tool.execute({ query: 'x' }, ctx);

    expect(result).toContain('socket hang up');
    expect(result).not.toContain('at ');
  });

  it('declares a json-schema with query required', () => {
    const tool = createSearchWebTool({ search: async () => [hit()] });
    const params = tool.parameters as {
      properties: Record<string, unknown>;
      required: string[];
    };

    expect(tool.name).toBe('search_web');
    expect(params.properties.query).toBeDefined();
    expect(params.required).toContain('query');
  });
});
