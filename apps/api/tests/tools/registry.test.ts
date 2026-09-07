import { describe, expect, it } from 'bun:test';
import {
  AGENT_TOOLS,
  findTool,
  toOpenAiTools,
} from 'services/aiChat/tools/registry';

describe('registry', () => {
  it('registers exactly the six expected tools', () => {
    expect(AGENT_TOOLS.map((t) => t.name).sort()).toEqual([
      'execute_code',
      'fetch_url',
      'grep_search',
      'list_directory',
      'read_file',
      'search_web',
    ]);
  });

  it('converts every tool into the OpenAI function-calling schema shape', () => {
    const schemas = toOpenAiTools();
    expect(schemas).toHaveLength(AGENT_TOOLS.length);
    for (const schema of schemas) {
      expect(schema.type).toBe('function');
      expect(schema.function.name).toBeTruthy();
      expect(schema.function.description).toBeTruthy();
      expect(schema.function.parameters).toBeTruthy();
    }
  });

  it('finds a tool by name', () => {
    expect(findTool('execute_code')?.name).toBe('execute_code');
  });

  it('returns undefined for an unknown tool name', () => {
    expect(findTool('does_not_exist')).toBeUndefined();
  });
});
