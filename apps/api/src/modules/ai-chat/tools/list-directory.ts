import { isPathAllowed } from 'modules/ai-chat/tools/path-validation';
import type { AgentTool } from 'modules/ai-chat/tools/types';

export const listDirectoryTool: AgentTool = {
  name: 'list_directory',
  description:
    'Lista os arquivos e pastas dentro de um diretório em /repo (código-fonte) ou /tmp (scratch da sessão).',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description:
          'Caminho absoluto do diretório, ex: /repo/marquinhos-web-api/apps/api/src/modules/ai-chat',
      },
    },
    required: ['path'],
  },
  async execute(args, ctx) {
    const path = String(args.path ?? '');
    if (!isPathAllowed(path)) {
      return `Erro: caminho "${path}" não é permitido. Use apenas caminhos dentro de /repo ou /tmp.`;
    }
    const result = await ctx.exec(ctx.containerId, ['ls', '-la', path]);
    if (result.exitCode !== 0) {
      return `Erro ao listar "${path}": ${result.stderr.slice(0, 2000)}`;
    }
    return result.stdout.slice(0, 4000);
  },
};
