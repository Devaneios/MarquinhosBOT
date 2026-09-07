import { isPathAllowed } from 'services/aiChat/tools/pathValidation';
import type { AgentTool } from 'services/aiChat/tools/types';

export const grepSearchTool: AgentTool = {
  name: 'grep_search',
  description:
    'Busca um padrão de texto recursivamente dentro de /repo (código-fonte) ou /tmp (scratch da sessão).',
  parameters: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Padrão a buscar (regex do grep)',
      },
      path: {
        type: 'string',
        description: 'Diretório onde buscar. Padrão: /repo',
      },
    },
    required: ['pattern'],
  },
  async execute(args, ctx) {
    const pattern = String(args.pattern ?? '');
    const path = String(args.path ?? '/repo');
    if (!isPathAllowed(path)) {
      return `Erro: caminho "${path}" não é permitido. Use apenas caminhos dentro de /repo ou /tmp.`;
    }
    const result = await ctx.exec(ctx.containerId, [
      'grep',
      '-rn',
      pattern,
      path,
    ]);
    if (result.exitCode !== 0 && result.exitCode !== 1) {
      return `Erro ao buscar "${pattern}" em "${path}": ${result.stderr.slice(0, 2000)}`;
    }
    return result.stdout.slice(0, 4000) || '(nenhum resultado encontrado)';
  },
};
