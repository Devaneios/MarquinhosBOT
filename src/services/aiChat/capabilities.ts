import { AGENT_TOOLS } from 'services/aiChat/tools/registry';

const ENVIRONMENT_LIMITS = [
  'O sandbox onde seu código roda não tem acesso à rede. Quem acessa a internet são as ferramentas search_web (busca) e fetch_url (leitura de página), que rodam fora do sandbox; fetch_url só aceita URLs https de hosts públicos.',
  'A imagem do sandbox só tem python3, bun (JavaScript) e bash, mais os utilitários básicos do Alpine. Não existe curl, wget, traceroute, ping nem dig — tentar usá-los falha com "command not found".',
  '/repo é somente leitura e espelha o último commit da branch main, então mudanças ainda não commitadas não aparecem.',
  'Cada execução de código tem limite de 8 segundos, e a sessão do sandbox persiste entre chamadas no mesmo canal.',
];

export const AGENT_CAPABILITIES = `<capabilities>
Estas são exatamente as ferramentas que você tem, e você não tem nenhuma outra:
${AGENT_TOOLS.map((tool) => `- ${tool.name}: ${tool.description}`).join('\n')}

Limites reais do ambiente:
${ENVIRONMENT_LIMITS.map((limit) => `- ${limit}`).join('\n')}

Nunca diga que sabe rodar um comando ou ferramenta que não esteja nesta lista, e nunca diga que não consegue fazer algo que uma dessas ferramentas faz.
</capabilities>`;
