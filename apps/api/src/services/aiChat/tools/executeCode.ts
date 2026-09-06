import type { AgentTool } from 'services/aiChat/tools/types';

const LANGUAGE_COMMANDS: Record<string, (code: string) => string[]> = {
  python: (code) => ['python3', '-c', code],
  javascript: (code) => ['bun', '-e', code],
  bash: (code) => ['bash', '-c', code],
};

const AVAILABLE_BINARIES =
  'python3, bun (JavaScript), bash e os utilitários básicos do Alpine (ls, grep, head, sed, awk...)';

const NETWORK_BINARIES = [
  'curl',
  'wget',
  'traceroute',
  'ping',
  'dig',
  'nslookup',
  'nc',
  'telnet',
  'ssh',
];

function missingBinaryHint(stderr: string): string {
  const named = stderr.match(
    /([\w.-]+)\s*:\s*(?:command not found|not found)/i,
  )?.[1];

  if (named && NETWORK_BINARIES.includes(named.toLowerCase())) {
    return `Dica: "${named}" não existe na imagem do sandbox, e o sandbox não tem acesso à rede de propósito. Para acessar a internet use a ferramenta fetch_url, que roda fora do sandbox.`;
  }

  if (named) {
    return `Dica: "${named}" não existe na imagem do sandbox. Disponíveis: ${AVAILABLE_BINARIES}.`;
  }

  return `Dica: exit code 127 significa comando não encontrado. A imagem do sandbox só tem ${AVAILABLE_BINARIES}.`;
}

export const executeCodeTool: AgentTool = {
  name: 'execute_code',
  description: `Executa um trecho de código dentro do sandbox da sessão. Linguagens suportadas: python, javascript, bash. O sandbox não tem acesso à rede (para buscar algo na internet use fetch_url) e só tem ${AVAILABLE_BINARIES}; a sessão persiste entre chamadas.`,
  parameters: {
    type: 'object',
    properties: {
      language: {
        type: 'string',
        enum: ['python', 'javascript', 'bash'],
        description: 'Linguagem do código a executar',
      },
      code: { type: 'string', description: 'Código a executar' },
    },
    required: ['language', 'code'],
  },
  async execute(args, ctx) {
    const language = String(args.language ?? '');
    const code = String(args.code ?? '');
    const buildArgv = LANGUAGE_COMMANDS[language];
    if (!buildArgv) {
      return `Erro: linguagem "${language}" não suportada. Use python, javascript ou bash.`;
    }
    const result = await ctx.exec(ctx.containerId, buildArgv(code));
    const output = [
      result.stdout && `stdout:\n${result.stdout}`,
      result.stderr && `stderr:\n${result.stderr}`,
      `exit code: ${result.exitCode}`,
      result.exitCode === 127 && missingBinaryHint(result.stderr),
    ]
      .filter(Boolean)
      .join('\n\n');
    return output.slice(0, 4000);
  },
};
