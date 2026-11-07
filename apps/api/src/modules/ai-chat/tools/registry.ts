import { executeCodeTool } from 'modules/ai-chat/tools/execute-code';
import { fetchUrlTool } from 'modules/ai-chat/tools/fetch-url';
import { grepSearchTool } from 'modules/ai-chat/tools/grep-search';
import { listDirectoryTool } from 'modules/ai-chat/tools/list-directory';
import { readFileTool } from 'modules/ai-chat/tools/read-file';
import { searchWebTool } from 'modules/ai-chat/tools/search-web';
import type { AgentTool } from 'modules/ai-chat/tools/types';
import type OpenAI from 'openai';

export const AGENT_TOOLS: AgentTool[] = [
  listDirectoryTool,
  grepSearchTool,
  readFileTool,
  executeCodeTool,
  searchWebTool,
  fetchUrlTool,
];

export function createAgentTools(searchTool: AgentTool): AgentTool[] {
  return [
    listDirectoryTool,
    grepSearchTool,
    readFileTool,
    executeCodeTool,
    searchTool,
    fetchUrlTool,
  ];
}

export function toOpenAiTools(
  tools: AgentTool[] = AGENT_TOOLS,
): OpenAI.Chat.Completions.ChatCompletionFunctionTool[] {
  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

export function findTool(
  name: string,
  tools: AgentTool[] = AGENT_TOOLS,
): AgentTool | undefined {
  return tools.find((tool) => tool.name === name);
}
