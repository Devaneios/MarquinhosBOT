# Comando `/ia`: threads com memória e pesquisa profunda

Data: 2026-07-26
Repositórios: `marquinhos-web-api` (API) e `MarquinhosBOT` (bot)

## Objetivo

Adicionar um comando `/ia` no bot com dois subcomandos que respondem em **thread**, não em reply:

- `/ia perguntar <pergunta>` — pergunta ao LLM com ferramentas completas, mantendo o contexto da
  conversa (incluindo o reasoning do próprio modelo) ao longo dos turnos da thread.
- `/ia pesquisar <tema>` — pipeline de agente que busca no SearXNG, lê as páginas encontradas e
  entrega um relatório completo com citações na thread.

O fluxo de tag (`@Marquinhos` no canal Devaneios) continua exatamente como é hoje: classificação
em duas camadas, persona, respostas customizadas por categoria e revisão. Os comandos novos
**não** passam por esse fluxo.

## Decisões tomadas

| Decisão | Escolha | Motivo |
|---|---|---|
| Reasoning na thread | **Não exposto**, apenas retido em contexto e gravado no trace | Escolha do usuário. A API da OpenAI só devolve resumos de reasoning; expor isso na thread poluiria a conversa sem ganho real |
| Ferramentas na pergunta básica | **Completas** (sandbox, grep, read_file, fetch_url, search_web) | Escolha do usuário. `/ia perguntar` é um agente conversacional, não um passthrough de LLM |
| Entrega da pesquisa profunda | **Job assíncrono** com polling | Múltiplas rodadas de busca + fetch estouram os 120s do `HttpClient` do bot e o token de interação do Discord |
| API da OpenAI | **Responses API** (`client.responses.create`) | É a única que devolve items de `reasoning` com `encrypted_content` reenviáveis, e suporta `reasoning.context: 'all_turns'` — exatamente o requisito de manter o contexto incluindo reasoning |
| Escopo do `/ia` | Qualquer canal de texto da guild | Threads são isoladas por natureza; a restrição de canal da tag existe por causa do ruído em canal aberto |

## Arquitetura

### Estado atual e por que ele precisa mudar

Dois arquivos concentram o que as features novas precisam reusar:

- `services/aiChat/tools/fetchUrl.ts` (365 linhas) mistura política de SSRF, fetch com cap de
  corpo, conversão HTML→markdown, extração de links **e** o schema da tool. A pesquisa profunda
  precisa do núcleo (fetch + markdown) sem o invólucro de tool.
- `services/aiChat/AgentToolLoopService.ts` (386 linhas) mistura o loop de agente, os budgets, o
  dispatch de tools, o wrap-up e o tracing — tudo amarrado ao Chat Completions e sem persistência
  de transcript. As threads precisam do mesmo loop com transcript persistido e outro driver de LLM.

Duplicar qualquer um dos dois seria a pior saída. A resposta é extrair os núcleos e deixar os
consumidores finos.

### Estrutura resultante na API

```
src/services/aiChat/
  web/
    fetchPage.ts            núcleo extraído de tools/fetchUrl.ts: SSRF + fetch + markdown + links
    SearxngClient.ts        search(query, opts) -> SearchHit[]
  tools/
    fetchUrl.ts             wrapper fino sobre fetchPage (comportamento idêntico ao atual)
    searchWeb.ts            nova AgentTool sobre SearxngClient
  llm/
    ResponsesClient.ts      Responses API: reasoning, function tools, structured output, tracing
  agent/
    AgentLoop.ts            núcleo do loop: dispatch, budgets, deadline, wrap-up, tracing
    TranscriptStore.ts      interface de transcript: em memória (tag) | SQLite (thread)
  thread/
    ThreadSessionStore.ts   TranscriptStore em SQLite + compactação por orçamento de tokens
    AiThreadService.ts      orquestra um turno de thread
  research/
    SourceReader.ts         lê e comprime uma fonte (fetchPage + extração via LLM)
    DeepResearchService.ts  pipeline plan -> search -> read -> extract -> reflect -> synthesize
    ResearchJobStore.ts      jobs + eventos de progresso em SQLite
    researchPrompts.ts      prompts e schemas de cada etapa
  AgentToolLoopService.ts   passa a ser configuração fina sobre AgentLoop
```

`AgentToolLoopService` migra para o `AgentLoop` com o driver da Responses API. Isso deixa **um só
caminho de código** de agente. O fluxo de tag ganha `search_web` e reasoning como efeito colateral
positivo; sua classificação, persona e formatação de resposta não mudam. Os testes existentes em
`tests/agentToolLoopService.test.ts` são a rede de segurança dessa migração.

### `/ia perguntar` — turno de thread

```
Bot                                  API
---                                  ---
deferReply()
cria thread ("💭 <pergunta>")
POST /api/ai-chat/thread/ask   -->   guardrail (injeção)
                                     rate limit (usuário + global + agente)
                                     ThreadSessionStore.load(threadId)
                                     AgentLoop.run(transcript, tools)
                                       ResponsesClient.create({
                                         reasoning: { effort, summary: 'auto',
                                                      context: 'all_turns' },
                                         store: false,
                                         include: ['reasoning.encrypted_content'],
                                         tools: [...]
                                       })
                                       dispatch de tools -> function_call_output
                                     ThreadSessionStore.append(items brutos)
posta na thread             <--      { reply, format, embedTitle, traceId }
```

Turnos seguintes: qualquer mensagem enviada na thread (sem tag, de qualquer pessoa) chama o mesmo
endpoint. O `messageCreate` do bot ganha um handler que reconhece threads de IA por consulta ao
próprio bot (thread criada pelo bot + registrada na API).

**Retenção de reasoning.** Os items devolvidos pela Responses API são persistidos brutos
(`ai_thread_items.item_json`), incluindo os items `reasoning` com `encrypted_content`. No turno
seguinte eles voltam no `input`, e `reasoning.context: 'all_turns'` faz o modelo enxergar o
raciocínio dos turnos anteriores. `store: false` garante que a OpenAI não retém estado — a fonte
de verdade é o nosso SQLite.

**Compactação.** Quando o transcript passa de `AI_THREAD_TOKEN_BUDGET`, os turnos mais antigos são
substituídos por um item de resumo gerado por uma chamada de LLM dedicada, preservando íntegros os
turnos recentes. Sem isso a thread quebra por limite de contexto depois de algumas dezenas de
turnos.

### `/ia pesquisar` — pipeline de pesquisa profunda

```
POST /api/ai-chat/research   -> 202 { jobId }        (idempotencyKey = id da interação)
GET  /api/ai-chat/research/:jobId -> { status, progress[], report?, sources?, stats? }
```

O job roda em background no processo da API. O bot faz polling e posta cada evento de progresso
novo na thread, e no fim posta o relatório em chunks de ≤2000 caracteres.

Etapas:

1. **Plan** — structured output `{ objective, subQueries: [{ query, rationale }] }`, 3 a 6
   sub-queries que decompõem o tema.
2. **Search** — `SearxngClient.search` para cada sub-query, em paralelo com concorrência limitada.
   Dedupe por URL normalizada (sem hash, sem tracking params) e cap de resultados por domínio para
   não afogar o relatório numa única fonte.
3. **Rank** — score do SearXNG combinado com concordância entre engines (quantos engines
   retornaram a mesma URL) e diversidade de domínio; seleciona top-N.
4. **Read** — `fetchPage` em paralelo com concorrência limitada, timeout por fonte, mesma guarda
   de SSRF do `fetch_url`.
5. **Extract** — uma chamada de LLM **por fonte**, devolvendo
   `{ relevant, summary, claims[], quotes[], publishedDate }` em relação ao objetivo. É esta etapa
   de compressão (map) que impede o contexto de explodir: o relatório final vê extrações curtas,
   não 24 páginas em markdown.
6. **Reflect** — structured output `{ sufficient, gaps[], followUpQueries[] }`. Se insuficiente e
   ainda há orçamento de rodadas/buscas, volta para a etapa 2 com as follow-up queries.
7. **Synthesize** — relatório em markdown com citações numeradas `[n]` inline e seção de fontes.
   Seções: resumo executivo, achados por tópico, divergências e incertezas, fontes.

Budgets (todos por env, com default): 3 rodadas, 12 buscas, 24 fetches, deadline de 8 minutos.
Quando um budget acaba no meio, o job sintetiza com o que tem e marca isso no relatório — o mesmo
princípio do `wrapUp` que o agente atual já usa.

### Persistência

Migration nova `003_ai_threads_and_research.sql`:

```sql
ai_thread_sessions (thread_id PK, guild_id, channel_id, owner_user_id, mode,
                    status, created_at, last_used_at, turn_count)
ai_thread_items    (id PK, thread_id, seq, item_json, created_at)
ai_research_jobs   (job_id PK, idempotency_key UNIQUE, thread_id, user_id, guild_id,
                    query, status, report, sources, stats, error, created_at, finished_at)
ai_research_events (id PK, job_id, seq, stage, message, created_at)
ai_research_usage  (user_id, guild_id, usage_date, count, PK(user_id, guild_id, usage_date))
```

Retenção segue o padrão de `ai_traces`: cleanup periódico por `created_at` com janela em env.

### Rate limit, guardrails e erros

- `/ia perguntar` reusa `RateLimitService` (diário por usuário e global) e
  `AgentRateLimitService` (loop de agente).
- `/ia pesquisar` ganha `ResearchRateLimitService` sobre `ai_research_usage`, mesmo padrão, com
  limite diário próprio e bem menor — cada pesquisa custa dezenas de chamadas de LLM.
- `GuardrailService.isInjectionAttempt` roda em todo turno de thread e no tema da pesquisa.
- Todo conteúdo externo (resultado de tool, página web, extração de fonte) entra no prompt dentro
  de bloco com `trust_level="untrusted"`, seguindo o padrão já estabelecido em `prompts.ts`.
- Falha de job: status `error` com mensagem, e o bot posta o fallback na thread.
- Idempotência: `POST /research` com `idempotencyKey` repetido devolve o job existente em vez de
  criar outro. Isso é obrigatório porque o `HttpClient` do bot faz retry automático em 5xx e
  timeout.

## Interface dos endpoints

### `POST /api/ai-chat/thread/ask`

```jsonc
// request
{ "threadId": "…", "guildId": "…", "channelId": "…", "userId": "…",
  "content": "…", "mode": "ask" }
// response 200
{ "data": { "status": "ok", "reply": "…", "format": "text",
            "embedTitle": null, "traceId": "…" } }
```

`status` também pode ser `rate_limited` ou `error`, como no `/respond` atual.

### `POST /api/ai-chat/research`

```jsonc
// request
{ "threadId": "…", "guildId": "…", "channelId": "…", "userId": "…",
  "query": "…", "idempotencyKey": "…" }
// response 202
{ "data": { "jobId": "…", "status": "queued" } }
```

### `GET /api/ai-chat/research/:jobId`

```jsonc
{ "data": { "jobId": "…", "status": "running",
            "progress": [{ "seq": 1, "stage": "plan", "message": "…" }],
            "report": null, "sources": null, "stats": null } }
```

`status` ∈ `queued | running | done | error`.

## Bot

- `src/commands/ai/ia.ts` — `MarquinhosCommand` com subcomandos `perguntar` e `pesquisar`.
- `src/services/aiChat/aiThread.ts` — criação de thread, envio de turno, formatação e split.
- `src/services/aiChat/researchProgress.ts` — poller do job, postagem de progresso e do relatório.
- `src/listeners/messageCreate.ts` — passa a chamar `handleAiThreadMessage` antes do
  `handleTagResponse`; se a mensagem está numa thread de IA registrada, o turno vai pro endpoint de
  thread e o handler de tag é ignorado.
- `src/services/marquinhosApi.ts` — métodos `askInThread`, `startResearch`, `getResearchJob`.
- Split de mensagens longas (>2000 chars) vai para `src/utils/discord.ts` como util compartilhado,
  já que agora tag, thread e relatório precisam dele.

## Testes

`bun test` nos dois repositórios, com dependências injetadas — o padrão que os testes atuais já
seguem.

| Unidade | Cobertura |
|---|---|
| `fetchPage` | fetch e lookup fakes: SSRF bloqueado, redirects, cap de corpo, HTML→markdown, links |
| `SearxngClient` | fetch fake: parse de resultados, erro HTTP, query encoding, timeout |
| `searchWeb` tool | formatação do resultado, ausência de resultados, erro |
| `ResponsesClient` | client fake: reasoning items preservados, tools mapeadas, tracing, erros |
| `AgentLoop` | driver e store fakes: budgets, deadline, wrap-up, dispatch, tool inexistente, JSON inválido |
| `AgentToolLoopService` | testes existentes continuam verdes após a migração |
| `ThreadSessionStore` | DB em memória: append/load, ordenação por seq, compactação por orçamento |
| `AiThreadService` | guardrail, rate limit, persistência do turno, formato da resposta |
| `DeepResearchService` | cada etapa isolada + pipeline completo com fakes; budgets estourados |
| `ResearchJobStore` | idempotência, transição de status, eventos de progresso |
| controllers e schemas | validação de body, códigos de status, 404 de job |
| bot: comando `/ia` | criação de thread, defer, chamada da API, erro |
| bot: `handleAiThreadMessage` | ignora não-threads, ignora threads não registradas, envia turno |
| bot: `researchProgress` | poll até `done`, postagem incremental, timeout, erro |

## Variáveis de ambiente novas

API:

| Variável | Default | Uso |
|---|---|---|
| `SEARXNG_URL` | `https://searxng.frois.net.br` | Base da instância SearXNG |
| `OPENAI_REASONING_EFFORT` | `medium` | `effort` do reasoning |
| `AI_THREAD_TOKEN_BUDGET` | `120000` | Gatilho de compactação do transcript |
| `AI_RESEARCH_MAX_ROUNDS` | `3` | Rodadas de reflexão |
| `AI_RESEARCH_MAX_SEARCHES` | `12` | Buscas totais por job |
| `AI_RESEARCH_MAX_FETCHES` | `24` | Páginas lidas por job |
| `AI_RESEARCH_DEADLINE_MS` | `480000` | Deadline do job |
| `AI_RESEARCH_RETENTION_DAYS` | `14` | Retenção de jobs e eventos |

Bot: nenhuma nova.

## Fora de escopo

- Streaming de tokens para o Discord (a Responses API suporta, mas o Discord exige edições
  sucessivas de mensagem e rate limit de edição torna isso ruim na prática).
- Migrar o fluxo de tag para threads — explicitamente pedido para ficar como está.
- Expor o resumo de reasoning na thread — decidido contra.
- Persistência de threads entre restarts do bot além do que a API já guarda (a API é a fonte de
  verdade; o bot não guarda estado).
