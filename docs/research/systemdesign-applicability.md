# Aplicação de 14 exercícios de system design ao Marquinhos

Análise de 26/10/2026 sobre os arquivos locais, incluindo alterações ainda não commitadas. Não é uma auditoria do ambiente em produção nem uma medição de carga. Nenhum comportamento da aplicação foi alterado nesta investigação.

A resposta inicial mencionou 11 exercícios distintos. Para completar os 14, esta análise acrescenta os itens 10, 17 e 26. As 14 páginas foram abertas individualmente. O SystemDesign.io apresenta principalmente perguntas orientadoras e referências externas. As propostas abaixo são avaliações para este repositório, sustentadas pelo código e por documentação oficial, não soluções atribuídas ao site.

## Avaliação geral

O projeto reúne bot Discord, API Express em Bun, frontend de Activities, PostgreSQL e salas Colyseus. HTTP, jogos e orquestração de IA compartilham o processo da API. A composição de produção descreve uma instância de API e uma de bot. Fontes: [inicialização da API](../../apps/api/src/index.ts), [composição de produção](../../deploy/docker-compose.yml).

O maior ganho provável é melhorar recuperação de falhas, controle de trabalho concorrente e diagnóstico. A evidência disponível não justifica introduzir Kafka, RabbitMQ, Redis ou um cluster como requisito inicial.

| Exercício | Utilidade para o projeto | Momento sugerido |
| --- | --- | --- |
| 9. Rate limiter | Separar cotas, rajadas e concorrência | Agora |
| 19. Fila distribuída | Executar pesquisas com recuperação explícita | Agora, junto com controle de concorrência |
| 23. Agendador | Recuperar tarefas perdidas durante indisponibilidade | Agora |
| 24. Notificações | Separar reserva de envio de confirmação de entrega | Agora |
| 35. Autenticação | Validar identidade e autorização nas fronteiras | Agora, revisão dirigida |
| 39. Saúde | Distinguir processo ativo de serviço pronto | Agora |
| 17. Métricas de desempenho | Medir interferência entre IA e jogos | Instrumentação inicial agora |
| 41. Tracing | Seguir uma interação entre bot e API | Incremental |
| 10. Logs e agregação | Consultar falhas com contexto consistente | Incremental |
| 14. Crawler | Melhorar eficiência e comportamento das leituras web | Incremental |
| 48. Atualização em tempo real | Conferir reserva de reconexão e recuperação de estado | Verificação prioritária |
| 49. Presença | Preservar contagem por pessoa e assentos corretos | Validar o comportamento existente |
| 26. Sessões simultâneas | Definir múltiplas conexões por usuário | Quando houver necessidade de produto ou abuso |
| 22. Top K | Definir empates e confirmar planos de consulta | Manter e medir antes de redesenhar |

## 1. Item 9: rate limiter

O [exercício](https://systemdesign.io/question/design-an-api-rate-limiter) pergunta quem limitar, qual algoritmo usar e como tratar falhas e múltiplas instâncias.

**Fato observado.** Os limitadores HTTP estão comentados em [index.ts:84](../../apps/api/src/index.ts#L84). [RateLimitService](../../apps/api/src/services/aiChat/RateLimitService.ts) controla cotas diárias com transação. [DailyQuotaService](../../apps/api/src/services/aiChat/DailyQuotaService.ts) mantém cotas de agentes e pesquisas. As salas aplicam um [contador por conexão](../../apps/api/src/services/activity/shared/RateLimiter.ts), com limites configurados pelos adapters.

**Aplicação recomendada.** Tratar separadamente requisições por intervalo, orçamento diário de IA e quantidade de trabalhos em execução. Uma cota diária permite que muitas pesquisas comecem juntas. Identificar usuários autenticados por identidade validada. Nas chamadas do bot, a chave técnica identifica o bot inteiro, então limites de produto também precisam considerar o usuário e o servidor informados pelo cliente confiável. Validar o endereço de cliente conforme o caminho real de proxies antes de usar IP.

**Limite da proposta.** Não reativar cegamente o limite global de 100 requisições por 15 minutos: polling e jogos podem ter padrões diferentes. O armazenamento em memória do express-rate-limit reinicia com o processo e não compartilha contadores entre instâncias. Fonte: [configuração oficial](https://express-rate-limit.mintlify.app/reference/configuration).

**Como demonstrar utilidade.** Testar rajadas de um usuário sem bloquear outro, excesso de pesquisas concorrentes e polling legítimo. Abrir uma segunda conexão não deve multiplicar um limite definido por pessoa.

## 2. Item 19: fila de pesquisas

O [exercício](https://systemdesign.io/question/design-a-distributed-queue-like-rabbitmq) distingue fila de distribuição de eventos e enfatiza recuperação de falhas.

**Fato observado.** O [ResearchJobStore](../../apps/api/src/services/aiChat/research/ResearchJobStore.ts) já persiste trabalhos, eventos e uma chave de idempotência. Porém, [ResearchOrchestrator.start](../../apps/api/src/services/aiChat/research/ResearchOrchestrator.ts#L102) executa a pesquisa no processo. `findStale` busca todos os trabalhos `queued` e `running`, e o startup os marca como falha. Esse mecanismo pressupõe uma instância responsável por todos os trabalhos.

**Aplicação recomendada.** Aproveitar o armazenamento existente e introduzir um consumidor com concorrência limitada. A reserva de um trabalho precisa ser atômica, com proprietário, prazo de reserva, tentativas e data de próxima execução. Um processo não pode concluir um trabalho cuja reserva já perdeu. PostgreSQL permite `SKIP LOCKED` em consumidores de filas, com as ressalvas da [documentação do SELECT](https://www.postgresql.org/docs/17/sql-select.html). A transação de reserva deve terminar antes da chamada longa ao modelo.

**Limite da proposta.** Fila durável permite reenfileirar, mas não retoma sozinha a pesquisa de onde parou. Recomeçar todas as chamadas pode repetir custo de IA. Definir primeiro se a recuperação reinicia a pesquisa, aproveita páginas extraídas persistidas ou encerra com falha explícita. Também seria necessário substituir a limpeza global de trabalhos no startup antes de executar duas APIs.

**Como demonstrar utilidade.** Encerrar um consumidor durante uma pesquisa e verificar o destino do trabalho, o limite de tentativas e o custo repetido. Dois consumidores não podem reservar o mesmo trabalho ao mesmo tempo.

## 3. Item 23: agendador

O [exercício](https://systemdesign.io/question/design-a-job-scheduler) começa com uma máquina e pergunta como executar no horário e lidar com tarefas simultâneas.

**Fato observado.** [ready.ts:259](../../apps/bot/src/listeners/ready.ts#L259) agenda a rotação diária com timers. Também há broadcasts recorrentes e uma publicação semanal. A [manutenção do banco](../../packages/database/src/maintenance.ts) usa intervalos para limpezas.

**Aplicação recomendada.** Diferenciar limpeza periódica de evento de produto. Limpezas podem reaplicar um predicado de expiração. Rotação e publicação precisam de uma ocorrência identificável, como tipo, servidor e data de Recife, com unicidade e estado de execução. No startup, reconciliar ocorrências pendentes e decidir quais ainda fazem sentido enviar.

**Limite da proposta.** Não transformar todo `setInterval` em trabalho persistido. Uma publicação atrasada de dias pode não ter valor. A sequência atual de rotação também inclui resumo, ranking e anúncio: recuperar uma execução parcial exige saber quais etapas já terminaram.

**Como demonstrar utilidade.** Deixar o bot indisponível na meia-noite, reiniciar e conferir uma única rotação e a política escolhida para anúncios atrasados.

## 4. Item 24: notificações

O [exercício](https://systemdesign.io/question/design-a-notification-service-at-scale) destaca origem, armazenamento temporário e entrega.

**Fato observado.** [WordleService.markAnnounced:537](../../apps/api/src/services/wordle.ts#L537) grava `announced_at` antes do envio. Tanto o [comando](../../apps/bot/src/commands/games/termo.ts#L168) quanto o [poller](../../apps/bot/src/listeners/ready.ts#L303) disputam essa marcação. A disputa evita que os dois anunciem juntos. Porém, falhar depois da marcação pode deixar uma vitória registrada como anunciada sem mensagem entregue.

**Aplicação recomendada.** Registrar uma notificação pendente junto com o evento de negócio, depois reservar seu processamento com prazo. Confirmar o envio após obter o identificador da mensagem. Distinguir falhas temporárias de canal removido ou permissão negada. Respeitar os limites do Discord usando a infraestrutura do SDK e a [documentação de rate limits](https://docs.discord.com/developers/topics/rate-limits).

**Limite da proposta.** Banco e Discord não compartilham uma transação. Se o Discord aceitar a mensagem e a confirmação se perder, ainda há ambiguidade. Persistir uma fila não garante entrega exatamente uma vez. O anúncio atual pode fazer vários envios; cada etapa precisa de política própria se houver repetição.

**Como demonstrar utilidade.** Simular erro antes do envio, após aceitação e antes da confirmação local. Verificar perda, duplicação e caminho de recuperação em cada caso.

## 5. Item 22: Top K e rankings

O [exercício](https://systemdesign.io/question/top-k-elements-app-store-rankings-amazon-bestsellers) discute estrutura de ranking e frequência de atualização.

**Fato observado.** O [ranking de níveis](../../apps/api/src/services/gamification/LevelingService.ts#L91) usa filtro de servidor, ordenação e limite. O [schema](../../packages/database/src/schema/gamification.ts#L31) tem índice correspondente. O [ranking de Pong](../../apps/api/src/services/activity/pong/PongCompetitionService.ts#L185) limita a resposta e ordena por rating e desvio.

**Aplicação recomendada.** Definir desempate estável quando os critérios atuais forem iguais. Diferenciar top 10, posição individual e ranking por período. Conferir cada consulta com dados representativos e plano real. PostgreSQL pode usar índice compatível com `ORDER BY` e `LIMIT` para evitar processar todo o conjunto. Fonte: [índices e ordenação](https://www.postgresql.org/docs/17/indexes-ordering.html).

**Limite da proposta.** Não há evidência de que rankings precisem de Redis ou algoritmos aproximados. As [medições locais existentes](../data-model-performance.md) já oferecem um padrão de verificação, embora não provem o desempenho de todas as consultas de ranking.

**Como demonstrar utilidade.** Comparar planos, estabilidade nos empates e latência sob o volume esperado antes de acrescentar cache.

## 6. Item 35: autenticação

O [exercício](https://systemdesign.io/question/design-a-user-login-and-authentication-system) cobre credenciais, sessões e erros de autenticação.

**Fato observado.** Existem fluxos diferentes para [usuário e Activity](../../apps/api/src/middlewares/userAuth.ts), [bot](../../apps/api/src/middlewares/botAuth.ts), [OAuth](../../apps/api/src/controllers/auth.controller.ts) e [ingresso WebSocket](../../apps/api/src/services/activity/wsSessionToken.ts). O token de ingresso tem validade de cinco minutos e inclui usuário, servidor e instância.

**Aplicação recomendada.** Revisar as fronteiras entre identidade Discord, permissão no servidor e permissão sobre a sala. Criar uma matriz de rotas e mensagens indicando quem pode ler ou agir. Verificar no fluxo OAuth aplicável geração, armazenamento e conferência de `state`, conforme a [documentação do Discord](https://docs.discord.com/developers/topics/oauth2).

**Limite da proposta.** A presença de `state: ''` no handshake da Activity não prova isoladamente uma vulnerabilidade. O fluxo embutido precisa ser analisado conforme o SDK. Expiração do token de ingresso também não prova que uma conexão já aberta será encerrada após cinco minutos. Não há necessidade de criar senhas próprias para aplicar esse exercício.

**Como demonstrar utilidade.** Tentar ler uma sala de outra instância, agir como espectador, usar token expirado e executar controles de anfitrião como outro usuário.

## 7. Item 41: tracing

O [exercício](https://systemdesign.io/question/design-a-distributed-tracing-system) pergunta como relacionar informações de uma mesma requisição.

**Fato observado.** [AiTraceRecorder](../../apps/api/src/services/aiChat/AiTraceRecorder.ts) já registra eventos de modelo, ferramenta e sandbox. O [cliente do bot](../../apps/bot/src/services/marquinhosApi.ts) registra identificadores devolvidos por alguns fluxos de IA. Isso oferece parte do caminho, mas não representa instrumentação geral de HTTP, banco e jogos.

**Aplicação recomendada.** Relacionar `interactionId`, `requestId`, `traceId` e `jobId`, respeitando que uma interação pode gerar várias requisições e tentativas. Se houver instrumentação OpenTelemetry, propagar contexto entre serviços conforme a [documentação oficial](https://opentelemetry.io/docs/concepts/context-propagation/). Registrar duração por etapa, inclusive espera antes de executar um trabalho.

**Limite da proposta.** Preservar os traces de domínio já úteis. Não registrar cada frame do Pong nem enviar conversas completas para uma segunda plataforma por padrão. Avaliar o suporte real do runtime Bun antes de escolher instrumentação automática.

**Como demonstrar utilidade.** Partir de uma interação com falha no Discord e encontrar a tentativa HTTP, a chamada externa e o erro correspondentes.

## 8. Item 39: saúde do serviço

O [exercício](https://systemdesign.io/question/design-a-system-to-monitor-the-health-of-a-cluster) cobre sinais de saúde, heartbeat e reação a falhas.

**Fato observado.** A [rota de saúde](../../apps/api/src/routes/health.route.ts) devolve `ok`. A API só passa a ouvir após a inicialização, mas o endpoint não verifica a disponibilidade posterior do banco. O [Dockerfile](../../apps/api/Dockerfile#L36) usa essa rota no healthcheck, e o [deploy](../../deploy/deploy.sh#L105) aguarda o serviço ficar saudável.

**Aplicação recomendada.** Separar processo responsivo de prontidão para tráfego. Verificar banco com timeout curto e inicialização concluída. Informar disponibilidade degradada de IA, busca ou sandbox separadamente quando esses componentes não forem necessários para jogos e gamificação.

**Limite da proposta.** Não reiniciar a API inteira por uma indisponibilidade do provedor de IA. Falhas de dependência e travamento local exigem reações diferentes.

**Como demonstrar utilidade.** Derrubar o banco depois do startup e observar prontidão indisponível. Derrubar somente busca web e verificar a política de degradação das demais funções.

## 9. Item 14: leitura web e crawler

O [exercício](https://systemdesign.io/question/design-web-crawler) discute deduplicação, URLs visitadas, prioridades e intervalo por domínio.

**Fato observado.** [DeepResearchService](../../apps/api/src/services/aiChat/research/DeepResearchService.ts) já tem fronteira de busca, URLs visitadas, orçamentos e concorrência. [sourceRanking](../../apps/api/src/services/aiChat/research/sourceRanking.ts) normaliza URLs para deduplicação. [fetchPage](../../apps/api/src/services/aiChat/web/fetchPage.ts) limita corpo, redirecionamentos, tempo e páginas de PDF, além de filtrar destinos.

**Aplicação recomendada.** Distinguir limite de diversidade por domínio de intervalo entre requisições ao mesmo host. Avaliar cache temporário das extrações por URL e política de frescor. Distinguir URL tentada, leitura concluída e falha recuperável, pois a implementação registra a visita antes da leitura. Para coleta automática recorrente, definir tratamento de `robots.txt` conforme [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.txt).

**Limite da proposta.** Um cache não pode contornar a validação de destinos. Retentativas precisam caber no orçamento. A normalização remove parâmetros que podem ser semânticos em alguns sites, então equivalência de URLs deve ser verificada antes de reutilizar conteúdo entre pesquisas.

**Como demonstrar utilidade.** Medir downloads repetidos, falhas por host e fontes úteis por pesquisa. Um limite de concorrência global não demonstra espaçamento por host.

## 10. Item 48: atualização em tempo real

O [exercício](https://systemdesign.io/question/design-a-live-comments-feature-for-facebook) cobre distribuição de eventos para clientes conectados.

**Fato observado.** [MatchRoom](../../apps/api/src/realtime/MatchRoom.ts) já distribui mensagens. O [cliente](../../apps/activity/src/platform/realtime/colyseus/connection.ts) usa os sinais de reconexão do SDK. Os jogos usam mensagens próprias: o Pong transmite snapshots binários e o [adapter de cartas](../../apps/api/src/realtime/adapters/cardTableAdapter.ts) respeita visões diferentes por jogador e espectador.

**Ponto prioritário a verificar.** A busca em `apps/api/src` não encontrou `allowReconnection` nem `onDrop`. A [documentação oficial de reconexão](https://docs.colyseus.io/room/reconnection) exige reserva pelo servidor e distingue reconexão automática de retorno após reload. Portanto, os handlers e comentários do cliente não bastam para afirmar que o fluxo completo funciona. O projeto declara Colyseus 0.17, enquanto a documentação atual apresenta 0.18: confirmar o contrato da versão instalada e reproduzir a queda real antes de propor a correção. Os testes locais de sessão e lifecycle não foram executados nesta pesquisa e não demonstram por si só a recuperação do transporte real.

**Aplicação recomendada.** Verificar por jogo o estado recebido ao entrar, cair e voltar. Se mensagens incrementais puderem ser perdidas, usar versão e snapshot de recuperação conforme a necessidade do protocolo. Priorizar estado atual para snapshots substituíveis, preservando confirmações e ações que não podem ser descartadas.

**Limite da proposta.** Reconectar o socket não demonstra que todo estado de aplicação foi recuperado. A sincronização automática de schemas do Colyseus não deve ser presumida para todos os protocolos customizados. Não criar outro transporte ou barramento sem necessidade.

**Como demonstrar utilidade.** Reconectar durante mudança de turno e verificar estado convergente. Um espectador nunca deve receber a mão privada de outro jogador.

## 11. Item 49: presença

O [exercício](https://systemdesign.io/question/design-a-feature-to-show-the-number-of-users-viewing-a-page) chama atenção para identidade, recarregamentos e expiração de presença.

**Fato observado.** [MatchRoom.admitMember:475](../../apps/api/src/realtime/MatchRoom.ts#L475) agrega conexões por usuário. A sala publica contagens separadas de jogadores, espectadores e fila, e remove o membro quando sua última conexão sai.

**Aplicação recomendada.** Preservar a distinção entre pessoa, conexão e assento. Validar queda abrupta, duas abas e reconexão. Uma contagem visual pode tolerar atraso curto; capacidade da mesa e atribuição de assentos exigem a regra autoritativa do servidor.

**Limite da proposta.** O código já resolve a duplicação básica de abas. Não acrescentar contador distribuído por antecipação. Um TTL compartilhado passa a fazer sentido se vários processos precisarem representar a mesma presença.

**Como demonstrar utilidade.** Duas abas contam como uma pessoa. Fechar uma delas mantém o assento. Desconectar ambas não deixa um membro permanente na lista.

## 12. Item 10: logs e agregação

O [exercício](https://systemdesign.io/question/design-a-metrics-logging-and-aggregation-system) enfatiza coleta, indexação e busca de logs.

**Fato observado.** A [API](../../apps/api/src/utils/logger.ts) emite JSON com horário, nível e evento. [index.ts](../../apps/api/src/index.ts) também usa Morgan e saídas diretas de console. O bot tem [outro logger](../../apps/bot/src/utils/logger.ts). A composição examinada não define um serviço próprio de agregação de logs.

**Aplicação recomendada.** Padronizar campos de serviço, ambiente e correlação. Definir retenção e rotação, depois escolher coleta conforme a necessidade de consulta. Registrar códigos de erro e identificadores sem copiar tokens ou conteúdo completo de conversas.

**Limite da proposta.** Não começar construindo uma plataforma de logs. A ausência de coletor no Compose não prova ausência de coleta configurada no host. Logs explicam eventos individuais; métricas respondem frequência e tendência.

**Como demonstrar utilidade.** Localizar em uma consulta as mensagens do bot e da API para uma mesma falha, sem procurar manualmente em arquivos extensos.

## 13. Item 17: métricas de desempenho

O [exercício](https://systemdesign.io/question/system-to-collect-metrics-from-thousands-of-servers) pergunta o que medir, como coletar e quando alertar.

**Fato observado.** A [API](../../apps/api/src/index.ts) hospeda HTTP e Colyseus. [PongSession](../../apps/api/src/services/activity/pong/PongSession.ts) executa simulação e snapshots. A [extração de PDF](../../apps/api/src/services/aiChat/web/fetchPage.ts) ocorre no processo da API. Isso identifica um caminho plausível de interferência, mas não demonstra uma regressão medida.

**Aplicação recomendada.** Medir latência e erros por rota, atraso do event loop, duração do tick, salas ativas, pesquisas simultâneas, idade da fila, memória e duração das dependências. Comparar jogos com e sem pesquisa e leitura de PDF. Separar um worker pode ajudar também a isolar CPU, além de recuperar trabalhos.

**Limite da proposta.** Não transformar `userId`, `roomId` ou `traceId` em labels de séries temporais. A [documentação do Prometheus](https://prometheus.io/docs/practices/instrumentation/#do-not-overuse-labels) alerta sobre cardinalidade. Identificadores individuais pertencem aos logs e traces. Para tarefas periódicas, o timestamp da última execução bem-sucedida e a idade do trabalho mais antigo ajudam a detectar interrupção de progresso conforme as [orientações de instrumentação](https://prometheus.io/docs/practices/instrumentation/).

**Como demonstrar utilidade.** Reproduzir uma carga controlada e comparar percentis de latência e atraso de tick. Só então estabelecer limites e alertas com duração mínima para evitar ruído.

## 14. Item 26: sessões simultâneas

O [exercício](https://systemdesign.io/question/netflix-limit-the-number-of-screens-each-user-can-watch) discute identificação e contagem de sessões concorrentes.

**Fato observado.** A sala distingue múltiplas conexões da mesma pessoa, mas o [rate limiter](../../apps/api/src/services/activity/shared/RateLimiter.ts) usa a conexão como chave. O [token WebSocket](../../apps/api/src/services/activity/wsSessionToken.ts) autoriza ingresso durante cinco minutos. Isso não equivale a uma política de limite de sessões ativas.

**Aplicação recomendada.** Definir se duas abas podem controlar o mesmo assento, se uma será apenas observadora ou se a conexão mais nova substitui a anterior. Aplicar limites por usuário quando a regra for por pessoa. Para IA, um limite de trabalhos ativos por usuário e global tende a trazer mais valor imediato que limitar telas de jogo.

**Limite da proposta.** IP não é identidade confiável de usuário ou dispositivo. Não bloquear reconexões legítimas com uma regra de sessão única sem período de tolerância. Na arquitetura atual, essa decisão é primeiro uma regra de produto.

**Como demonstrar utilidade.** Abrir várias conexões com a mesma identidade e verificar política de controle, limite agregado e liberação após queda.

## Sequência sugerida

1. Medir o estado atual e tornar a prontidão verificável. Adicionar limites por rota e concorrência de IA conforme carga observada.
2. Tornar pesquisas e notificações recuperáveis, aproveitando PostgreSQL. Definir explicitamente repetição, custo e efeitos externos.
3. Persistir ocorrências do agendador que precisam sobreviver a reinícios. Validar autorização e os cenários de reconexão e múltiplas abas.
4. Unificar correlação e consulta de logs. Otimizar crawler e rankings apenas onde as medições indicarem ganho.

Esses passos são propostas. Esta investigação não executou testes de falha, benchmarks ou validação com credenciais reais. Os cenários de demonstração acima descrevem a evidência necessária para aprovar implementações futuras.
