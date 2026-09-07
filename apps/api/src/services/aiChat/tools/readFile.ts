import { isPathAllowed } from 'services/aiChat/tools/pathValidation';
import type { AgentTool } from 'services/aiChat/tools/types';

const MAX_BYTES = 20000;

export const readFileTool: AgentTool = {
  name: 'read_file',
  description: `Lê o conteúdo de um arquivo dentro de /repo (código-fonte) ou /tmp (scratch da sessão), truncado em ${MAX_BYTES} bytes.`,
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Caminho absoluto do arquivo' },
    },
    required: ['path'],
  },
  async execute(args, ctx) {
    const path = String(args.path ?? '');
    if (!isPathAllowed(path)) {
      return `Erro: caminho "${path}" não é permitido. Use apenas caminhos dentro de /repo ou /tmp.`;
    }
    const result = await ctx.exec(ctx.containerId, [
      'head',
      '-c',
      String(MAX_BYTES),
      path,
    ]);
    if (result.exitCode !== 0) {
      return `Erro ao ler "${path}": ${result.stderr.slice(0, 2000)}`;
    }
    return result.stdout;
  },
};
