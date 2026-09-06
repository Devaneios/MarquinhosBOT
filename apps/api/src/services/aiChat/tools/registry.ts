import type OpenAI from 'openai';
import { executeCodeTool } from 'services/aiChat/tools/executeCode';
import { fetchUrlTool } from 'services/aiChat/tools/fetchUrl';
import { grepSearchTool } from 'services/aiChat/tools/grepSearch';
import { listDirectoryTool } from 'services/aiChat/tools/listDirectory';
import { readFileTool } from 'services/aiChat/tools/readFile';
import { searchWebTool } from 'services/aiChat/tools/searchWeb';
import type { AgentTool } from 'services/aiChat/tools/types';

export const AGENT_TOOLS: AgentTool[] = [
  listDirectoryTool,
  grepSearchTool,
  readFileTool,
  executeCodeTool,
  searchWebTool,
  fetchUrlTool,
];

export function toOpenAiTools(): OpenAI.Chat.Completions.ChatCompletionFunctionTool[] {
  return AGENT_TOOLS.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

export function findTool(name: string): AgentTool | undefined {
  return AGENT_TOOLS.find((tool) => tool.name === name);
}
