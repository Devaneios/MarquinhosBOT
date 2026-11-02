# Terminhos: jornada global e comunidade — plano de implementação

> **Para quem executar:** usar `superpowers:subagent-driven-development` ou `superpowers:executing-plans`, tarefa por tarefa. As caixas registram progresso. Este plano reúne várias entregas independentes; cada fase deve gerar uma mudança revisável e funcional.

**Objetivo:** permitir uma jornada global com vitrine de conquistas e transformar descobertas individuais em histórias, recompensas e atividades comunitárias.

**Arquitetura:** partida, palavra do dia, progresso, descobertas e vitrine pertencem ao jogador; participação e recursos coletivos pertencem ao servidor. A API coordena transações e persistência; regras puras ficam no domínio; contratos compartilhados definem HTTP e Activity; o bot apresenta rankings e mensagens no Discord.

**Tecnologia:** TypeScript, Bun, PostgreSQL/Drizzle, Express, Colyseus, React, Discord e pnpm.

**Documentos de produto:** [índice e decisões](../../ideias-comunidade-terminhos/README.md), [vitrine](../../ideias-comunidade-terminhos/01-vitrine-pessoal.md), [autoria](../../ideias-comunidade-terminhos/02-autoria-e-contexto.md), [álbum](../../ideias-comunidade-terminhos/03-album-coletivo.md), [recompensas](../../ideias-comunidade-terminhos/04-recompensas-expressivas.md), [celebrações](../../ideias-comunidade-terminhos/05-celebracoes-sociais.md), [objetivos](../../ideias-comunidade-terminhos/06-objetivos-coletivos.md), [atividades](../../ideias-comunidade-terminhos/07-atividades-assincronas.md), [reconhecimento](../../ideias-comunidade-terminhos/08-reconhecimento-sem-moeda.md).

## Limites e decisões

- A mesma palavra e partida diária, rascunho, estatísticas, conquistas, evidência e vitrine pertencem ao jogador globalmente. `guildId` é contexto para participação e apresentação, não chave da jornada.
- O ranking contém apenas participantes da comunidade. Abrir ou jogar nela registra participação. Até três conquistas escolhidas aparecem junto ao nome; título fica fora da linha. Conquistas obtidas são visíveis. Evidência de desenho permanece fixa.
- Não alterar Terminhos/Wordle Race. Verificar consumidores de serviços e contratos compartilhados antes de mudar interfaces para não afetá-lo.
- As regras abaixo são **propostas do plano**, necessárias para torná-lo concreto; não são decisões anteriores do usuário. Revisar antes da execução: palavra diária única; vitrine inicialmente vazia e reordenável; participação persistente, com membros atuais elegíveis; ranking diário inclui quem abriu a comunidade no dia, mesmo após jogar em outra, e períodos maiores consideram resultados globais desde a primeira participação; remoção do membro exclui-o do ranking atual, preservando histórico; evidência mais antiga válida, com desempate determinístico por origem; evidências da palavra ativa públicas após a virada; conquistas secretas não obtidas permanecem ocultas.
- Proposta para conquistas de primeiro acerto no servidor: contar para cada comunidade em que o jogador estiver presente no dia, se sua resolução global for anterior à dos demais participantes presentes; presença posterior ao acerto não concede retroativamente a primazia. Consolidar o total por datas distintas, sem multiplicar o mesmo dia por servidor. Essa alteração de regra exige revisão antes da execução.
- Propostas sociais: contribuição automática para as comunidades em que o jogador abriu o jogo **na data da ocorrência**; a mesma ocorrência pode contribuir em mais de uma comunidade; entrada posterior não importa retrospectivamente. Não repetir XP. Progresso coletivo é histórico. Exibição da evidência espera a virada.
- Propostas de recompensas: itens pessoais globais, decorações do álbum locais, sem vantagem na partida. Cartão individual é manual; anúncios coletivos desligados por padrão. Atividades verificadas usam eventos ocorridos após sua abertura; não exigem novos desbloqueios.
- Datas do jogo usam `America/Recife`. Não publicar letras, resposta ou feedback de terceiros da palavra ativa. Nenhuma migração real, deploy, publicação ou mudança de dados externos faz parte da elaboração deste plano.

## Fatos e decisões de arquitetura

O estado atual está em `packages/database/src/schema/wordle.ts`: dias por servidor/data; sessões e rascunhos por jogador/servidor/data; evidência por jogador/servidor/desenho; sequências por jogador/servidor. `packages/database/src/schema/gamification.ts` compartilha desbloqueios com outros jogos, portanto a migração deve filtrar o catálogo de Terminhos. `WordleService`, `WordleDraftService` e `WordleAchievementService` implementam escrita, rascunhos e conquistas; os resultados passam por `apps/api/src/routes/wordle.route.ts`, controladores e protocolo Activity. O ranking diário é renderizado pelo bot em `termoLeaderboardImage.ts` e reutilizado no status e no fechamento. `docs/wordle.md` documenta o fluxo e critérios existentes.

**Alternativas:** (A) criar uma identidade global e tabela de participação separada; (B) eleger um servidor como dono dos dados globais. Recomenda-se A: B continua dependendo de um servidor arbitrário e complica entrada e saída. Para eventos sociais, recomenda-se registrar ocorrências persistentes na mesma transação do fato e processá-las idempotentemente; entrega direta ao Discord não pode fazer uma jogada falhar. Não reconstruir recorrência a partir apenas da primeira evidência.

**Responsabilidade sugerida:** `GlobalWordleService` ou adaptação de `WordleService` possui a sessão; `WordleCommunityService` registra participação e consulta ranking; `WordleAchievementService` concede conquistas globais; `WordleDiscoveryService` guarda evidência fixa e ocorrências; serviços de álbum, objetivos e atividades projetam fatos para cada comunidade; um entregador de notificações publica mensagens fora da transação. Adaptar nomes às convenções existentes ao executar, sem criar camadas que apenas encaminham chamadas.

**Modelo proposto:** `GameDay(date, answer)`, `PlayerSession(userId, date)`, `CommunityParticipation(guildId, userId, firstSeenAt, lastSeenAt)`, `DailyPresence(guildId, userId, date)`, `Discovery(userId, patternId, evidence, occurredAt)`, `Occurrence(id, userId, date, patternId, evidence)`, `Showcase(userId, orderedAchievementIds[0..3])`. IDs e contratos devem usar os esquemas Zod existentes; não expor resposta nem evidência protegida. Eventos comunitários são únicos por `occurrenceId + guildId + projection`.

**Fluxo principal:** abrir no servidor B → registrar participação e presença do dia → carregar a mesma sessão global criada em A → aceitar palpite sob trava global de jogador/data → salvar fato e avaliar conquistas → projetar contribuições elegíveis → atualizar Activity e rankings; avisos e mensagens são processados em separado com retry.

## Pontos de revisão e testes obrigatórios

1. Dois servidores enviam palpites ou rascunhos simultâneos: uma única sessão, sem perda ou revisão regressiva (tarefas 2 e 3).
2. Registros históricos conflitantes, duplicados e sem evidência: auditoria reproduzível, sem perda silenciosa nem débito de XP (tarefas 1 e 2).
3. Jogador entra depois de jogar ou sai do servidor: ranking aplica participação e período; terceiros não aparecem (tarefa 4).
4. Descoberta da palavra ativa em perfil, imagem, álbum ou anúncio: nenhum dado protegido antes da virada (tarefas 5–8).
5. Falha/retry de concessão, projeção ou Discord: palpite preservado; conquista, XP, contribuição e mensagem não duplicam (tarefas 3, 6 e 8).

## Sequência e entregáveis

Cada tarefa inclui testes comportamentais antes da implementação, execução focalizada, implementação, execução repetida, revisão do diff e commit separado quando o usuário escolher uma estratégia de execução. Comandos `bun test` abaixo usam os scripts e fixtures existentes; testes de banco precisam do ambiente de teste do repositório, nunca dados reais.

### 1. Inventário e contrato de migração

**Arquivos:** `packages/database/src/schema/wordle.ts`, `packages/database/src/schema/gamification.ts`, `apps/api/src/services/wordle.ts`, `apps/api/src/services/wordle/WordleAchievementService.ts`; criar `apps/api/scripts/auditGlobalWordle.ts` e `docs/wordle-global-migration.md`.

- [ ] Inventariar leitura/escrita, rotas, salas, anúncios, jobs, exportação e exclusão por usuário; documentar também usos compartilhados com Race sem alterá-los.
- [ ] Criar auditoria somente leitura que conte dias com palavras diferentes, sessões duplicadas por jogador/data, rascunhos, desbloqueios e evidências duplicados, diferenças de XP e presença histórica. Saída agregada, sem respostas, palpites, tokens ou identificadores pessoais.
- [ ] Em fixtures isoladas, demonstrar que a auditoria distingue duplicata idêntica, partidas divergentes e palavras divergentes. Executar `bun test apps/api/tests/wordleGlobalAudit.test.ts`.
- [ ] Definir plano de preservação: cópia e mapa de origens, manifesto de conflitos, validação de integridade, dry-run reproduzível, pausa de escritores, retomada e restauração. Nunca escolher arbitrariamente entre sessões ou palavras divergentes: o dry-run deve parar com manifesto para resolução revisável. XP pré-existente é preservado, não debitado.
- [ ] Conferir opções propostas no topo com o usuário antes de aplicar uma migração real; o inventário informa decisões históricas ainda desconhecidas.

### 2. Schema global e conversão histórica

**Arquivos:** `packages/database/src/schema/wordle.ts`, `packages/database/src/schema/gamification.ts`, migração Drizzle nova, `apps/api/scripts/migrateGlobalWordle.ts`, `apps/api/tests/wordleGlobalMigration.test.ts`.

- [ ] Adicionar estruturas globais com unicidade por data e por jogador/data, participação e presença comunitária, vínculo entre origens e registro de migração. Preservar esquema compartilhado de conquistas dos outros jogos; separar a identidade global de Terminhos sem remover XP de servidor.
- [ ] Criar conversor repetível sobre snapshot de teste: duplicatas idênticas consolidam; desbloqueios de Terminhos por jogador/ID consolidam com registro de origem; evidência válida mais antiga vence por `(discoveredAt, sessionId, guildId)`; ausência de evidência mantém conquista sem inventar desenho.
- [ ] Para conflito de palavra, sessão, rascunho ou semântica de XP não resolvido, produzir manifesto e interromper a aplicação. Preservar cópias originais e não modificar dados ativos parcialmente. Testar execução repetida e rollback com restauração a partir de snapshot.
- [ ] Definir presença histórica como proposta separada: sessões antigas comprovam presença no dia; não inferir aberturas sem registro. Comparar totais e amostras com origem sem registrar conteúdo sensível.
- [ ] Executar `bun test apps/api/tests/wordleGlobalMigration.test.ts` e verificações de migração do pacote database. Não rodar contra produção.

### 3. Jogada global, rascunho e conquistas

**Arquivos:** `apps/api/src/services/wordle.ts`, `apps/api/src/services/wordle/WordleDraftService.ts`, `apps/api/src/services/wordle/WordleAchievementService.ts`, `apps/api/src/services/wordle/gameplayLock.ts`, controladores, salas e `packages/contracts/src/http/routes/wordle.ts`; testes `apps/api/tests/wordle.test.ts`, `wordleDrafts.test.ts`, `wordleAchievements.test.ts` e `matchRoomWordle.test.ts`.

- [ ] Criar palavra única por data e sessão única por jogador/data. Isolar configurações e rotação por servidor que dependiam de palavras próprias; atualizar comandos administrativos e estado de fechamento explicitamente.
- [ ] Usar trava compartilhada por jogador/data para palpite, finalização e rascunho; preservar revisão otimista e vitória de rascunho sem tentativas. Bot e Activity devem carregar a mesma sessão em servidores diferentes.
- [ ] Substituir o `first_solver` preso à sessão por registro de primeiro acerto por comunidade/data, deduplicando por jogador/data ao avaliar os marcos globais; registrar resolução apenas para comunidades com presença anterior ou simultânea. Testar solução antes/depois de abrir em B e presença de dois jogadores no mesmo dia.
- [ ] Avaliar conquistas e descobertas globalmente; preservar lógica de reconciliação após falha e concessão uma vez por jogador/conquista. Manter evidência fixa mesmo após outra ocorrência.
- [ ] Produzir ocorrência durável para cada figura reconhecida em cada sessão, inclusive quando a conquista já existe, deduplicada por `(userId, date, patternId)`; a concessão não depende da projeção social.
- [ ] Adicionar testes de concorrência, reentrada, recuperação de falha e palavra única; executar `bun test apps/api/tests/wordle.test.ts apps/api/tests/wordleDrafts.test.ts apps/api/tests/wordleAchievements.test.ts apps/api/tests/matchRoomWordle.test.ts` com serviços de teste configurados.

### 4. Participação e ranking por comunidade

**Arquivos:** `apps/api/src/services/wordle.ts`, criar `apps/api/src/services/wordle/WordleCommunityService.ts`, `packages/contracts/src/wordle.ts`, `apps/bot/src/commands/games/termoLeaderboardImage.ts`, `apps/bot/src/listeners/ready.ts`.

- [ ] Registrar participação idempotente ao abrir/jogar e presença por dia; não registrar quem apenas pertence ao Discord. Definir e implementar confirmação de membros atuais na borda Discord, com comportamento explícito de indisponibilidade: falhar sem publicar ranking potencialmente incorreto.
- [ ] Aplicar as janelas propostas nas regras globais, mantendo pontuação diária e média documentadas em `docs/wordle.md`; apurar primeiro a presença local e depois associar resultado global. Recalcular contadores e sequência coletiva com presença local, sem duplicar sessões globais.
- [ ] Atualizar ranking diário, semanal, mensal, histórico, status periódico e encerramento. Testar entrada depois de jogar, não participante, saída, volta, servidores pequenos e dois servidores com posições diferentes.
- [ ] Executar `bun test apps/api/tests/wordle.test.ts apps/bot/tests/termoLeaderboardImage.spec.ts` e testes dos contratos modificados.

### 5. Perfil, vitrine e evidência

**Arquivos:** `packages/contracts/src/wordle.ts`, `packages/contracts/src/http/routes/wordle.ts`, `apps/api/src/routes/wordle.route.ts`, `apps/api/src/services/wordle/WordleAchievementService.ts`, `apps/activity/src/games/wordle/components/WordleAchievementsScreen.tsx`, `apps/bot/src/commands/games/termoAchievements.ts`, `apps/bot/src/commands/games/termoLeaderboardImage.ts`, componentes de imagem em `apps/bot/src/ui/`.

- [ ] Criar contrato para ler perfil global e atualizar sequência ordenada de 0 a 3 IDs distintos já desbloqueados pelo próprio usuário. Edição só pelo dono; leitura visível a membros autorizados pelo contexto do Discord. Rejeitar IDs duplicados, inválidos e não conquistados.
- [ ] Adicionar edição, reordenação, remoção e prévia na Activity; disponibilizar acesso ao perfil e coleção no Discord. Perfil antigo ou sem evidência deve renderizar sem erro.
- [ ] Acrescentar os mesmos três ícones na linha dos rankings e manter nome, posição e resultado legíveis; imagem estática aponta ao comando/perfil para detalhes. Não incluir título na linha.
- [ ] Centralizar política de apresentação por data: dono vê sua evidência, terceiros recebem somente conteúdo seguro antes da virada; catálogo oculto não obtido mantém condição secreta. Testar respostas HTTP, Activity e imagem, inclusive dados ausentes.
- [ ] Executar testes focados de Activity, contratos, API e `bun test apps/bot/src/commands/games/termoAchievements.test.ts apps/bot/tests/termoLeaderboardImage.spec.ts`.

### 6. Autoria e álbum comunitário

**Arquivos:** criar `packages/domain/src/games/wordle/community/album.ts`, `apps/api/src/services/wordle/WordleAlbumService.ts`, schema em `packages/database/src/schema/wordle.ts`, contratos/rotas Wordle, `apps/activity/src/games/wordle/components/WordleAlbumScreen.tsx`.

- [ ] Criar página por figura e comunidade, registro de contribuição por ocorrência/comunidade e marco por conjunto. Cada figura conta uma vez; contribuições adicionais atualizam contagem distinta sem novo desbloqueio. Nomear como "primeira contribuição registrada", não primeira descoberta histórica.
- [ ] Projetar apenas ocorrências com presença local naquele dia; uma ocorrência pode contribuir para mais de uma comunidade. Reprocessar eventos idempotentemente; atrasos anteriores à virada podem atualizar o registro, mas publicação de evidência aguarda a virada.
- [ ] Exibir categorias, progresso, figura de catálogo, contribuintes e autoria pessoal com evidência fixa quando disponível. Tratar álbum vazio e usuário que chega após conclusão. Preservar marcos antigos quando catálogo crescer.
- [ ] Testar repetição, projeção tardia, empate por `(occurredAt, occurrenceId)`, exclusão/correção de origem e ausência de evidência. Definir exclusão: remover identidade/evidência do usuário excluído, reatribuir crédito à próxima contribuição válida e manter marco com contagem recalculada; se não houver contribuição válida, página volta a disponível e marco histórico registra revisão.
- [ ] Rodar testes puros em `packages/domain` e testes de integração de álbum em `apps/api/tests/wordleAlbum.test.ts`.

### 7. Recompensas expressivas

**Arquivos:** criar `packages/domain/src/games/wordle/rewards.ts`, `apps/api/src/services/wordle/WordleRewardsService.ts`, schema Wordle, contratos e componentes de perfil da Activity.

- [ ] Definir catálogo inicial pequeno com um título para completar uma família e uma moldura para marco pessoal, com IDs estáveis e condições ligadas a conquistas existentes; decoração coletiva para conclusão de página. Definições concretas devem ser escolhidas do catálogo real e registradas no teste, sem alterar condições existentes.
- [ ] Posse pessoal é global; decoração é da comunidade. Equipar/trocar/remover não apaga posse; concessão retroativa e retry são idempotentes. Título aparece no perfil, nunca na linha do ranking.
- [ ] Temas e molduras mantêm contraste e não mudam feedback ou tentativas. Testar concessão retroativa, duplicação, equipamento de item não possuído e ausência de itens.
- [ ] Executar testes de domínio, API e componentes alterados. XP existente continua distinto de posse cosmética.

### 8. Celebrações e notificações

**Arquivos:** `apps/bot/src/commands/games/termoAchievements.ts`, `apps/bot/src/listeners/ready.ts`, `apps/bot/src/commands/games/termoLeaderboardImage.ts`, serviços e contratos Wordle; criar `apps/api/src/services/wordle/WordleNotificationService.ts`.

- [ ] Oferecer prévia e publicação manual de cartão individual, com destino explícito. Cartão da palavra ativa usa versão genérica segura; após a virada pode mostrar evidência. Perfil permanece visível independentemente da publicação.
- [ ] Anúncios coletivos por servidor são opt-in, no canal configurado, para página concluída e objetivo concluído. Sem canal/permissão, guardar pendência e não afetar jogada. Usar chave de deduplicação e reconciliação para falha após envio; documentar limites de confirmação do Discord e não prometer exatamente uma entrega sem mecanismo comprovado.
- [ ] Resumo semanal opt-in agrega marcos já elegíveis; sem novidades não envia. Reações são as do Discord, sem curtidas próprias.
- [ ] Testar spoiler, servidor errado, falha, retry e múltiplos eventos; executar testes de bot e API relativos às notificações.

### 9. Objetivos coletivos

**Arquivos:** criar `packages/domain/src/games/wordle/community/goals.ts`, `apps/api/src/services/wordle/WordleGoalService.ts`, schema Wordle, contratos, `apps/activity/src/games/wordle/components/WordleGoalsScreen.tsx`.

- [ ] Implementar estado `scheduled | active | finalizing | completed | expired`, com intervalo em Recife e alvo fixado na criação. Primeiro modelo: contribuições distintas por jogador/dia com pelo menos uma tentativa aceita, apenas com presença comunitária no mesmo dia. Vitória sem tentativa não conta. O mesmo fato pode contribuir em cada comunidade elegível.
- [ ] Administrador escolhe alvo inteiro positivo antes do início; sem ajuste posterior. Concluir registra decoração coletiva e emblema pessoal para quem contribuiu pelo menos uma vez; meta expirada guarda progresso sem recompensa de conclusão.
- [ ] Reprocessar fatos por chave objetivo/jogador/data. Fechar após reconciliação de eventos registrados até o fim, sem aceitar ações posteriores. Não inventar janela de entrega nem marcar concluído antes da conferência.
- [ ] Testar meta pequena, servidor com um jogador, duas comunidades, início/fim, repetição e evento atrasado. Executar testes de domínio e `apps/api/tests/wordleGoals.test.ts`.

### 10. Atividades assíncronas

**Arquivos:** criar `packages/domain/src/games/wordle/community/activities.ts`, `apps/api/src/services/wordle/WordleActivityService.ts`, schema Wordle, contratos e telas Activity; adicionar comandos de bot no diretório `apps/bot/src/commands/games/`.

- [ ] **Desafio:** jogador cria convite para uma figura conhecida, prazo e comunidade. Contar ocorrência válida após abertura, sem ordenar por velocidade; permitir entrada posterior até prazo. Encerrar com lista de participantes, sem XP adicional.
- [ ] **Bingo:** cartela comunitária fixa, inicialmente 3×3, com condições declaradas de participação ou famílias de figuras; um evento pode preencher múltiplas casas somente se indicado no cartão. Acompanhar linha e cartela sem exigir pessoas diferentes por casa. Usar ocorrências e presença do período; armazenar versão da cartela.
- [ ] **Galeria:** semanal, com no máximo uma entrada por participante e escolha determinística por categoria/tempo, somente evidências de dias encerrados. Sem dados, nenhuma publicação; reabrir perfil para autoria fixa e não inventar recorrência histórica.
- [ ] **Conversa:** administrador aciona pergunta sobre palavra já encerrada em canal configurado; não pontuar respostas. Adicionar agendamento opcional somente usando mecanismo de agendamento existente.
- [ ] Testar prazos, recorrência já desbloqueada, mesma ação em duas casas, zero entradas e segurança da palavra ativa. Eventos das atividades não criam sessões nem XP. Rodar testes de domínio, API e bot das novas atividades.

### 11. Reconhecimento, privacidade operacional e observabilidade

**Arquivos:** `apps/api/src/services/user.ts`, serviços Wordle, `docs/wordle.md`, `docs/wordle-operations.md`, telas e contratos alterados.

- [ ] Aplicar exclusão por usuário a dados globais, participação, evidência, ocorrências, vitrine, recompensas e projeções; recalcular contagens e tratar créditos como na tarefa 6. Não alterar dados de outros jogos.
- [ ] Expor origem dos itens e significado dos feitos; evitar ranking de curtidas, moeda e métricas públicas de popularidade. A pesquisa anterior é hipótese, não evidência de eficácia.
- [ ] Adicionar logs agregados para conflitos, atrasos e falhas de projeção/entrega, sem palavra, palpite ou dados sensíveis; documentação de recuperação e operação por servidor.
- [ ] Testar exclusão e reconciliação repetidas, interrupção e recuperação; validar acessibilidade de controles, texto, contraste e formatos sem animação obrigatória.

### 12. Validação integrada e implantação

**Arquivos:** `apps/api/tests/`, `apps/bot/tests/`, `apps/activity/src/games/wordle/`, `docs/wordle.md`, `docs/wordle-operations.md`, `docs/wordle-global-migration.md`.

- [ ] Em ambiente isolado, executar cenário completo: jogar em A, continuar em B, desbloquear figura, escolher vitrine, aparecer nos rankings locais, contribuir em álbuns elegíveis, cumprir meta, compartilhar após virada e consultar histórico.
- [ ] Repetir com falhas, concorrência, migração com conflito, membro ausente, spoiler e exclusão; verificar Race em testes existentes sem mudar seu comportamento.
- [ ] Executar `pnpm --filter @marquinhos/domain test`, `pnpm --filter marquinhos-web-api test`, `pnpm --filter marquinhosbot test`, `pnpm --filter marquinhos-activity-client test`, `pnpm typecheck` e `pnpm lint`; conferir nomes reais dos pacotes antes da execução e usar os scripts equivalentes se diferirem. Falhas preexistentes são registradas com evidência, nunca declaradas como aprovadas.
- [ ] Preparar sequência operacional: backup restaurável, auditoria somente leitura, congelamento de escritores e workers antigos, dry-run, resolução de conflitos, migração transacional/repetível, verificação de totais, ativação de binários compatíveis, monitoramento e procedimento de restauração. Testar restauração em ambiente isolado.
- [ ] Publicar plano de rollout e diferenças de contrato para Activity e bot. Deployment e migração de produção exigem uma instrução posterior do usuário; manter rollback até conclusão da validação.

## Dependências e decisões para revisão

1 → 2 → 3 → 4 → 5. A tarefa 6 depende de 3–4; 7 depende de 5–6; 8 depende de 5–6; 9 depende de 3–4 e 7; 10 depende de 3–4 e 6; 11 depende das funcionalidades presentes; 12 fecha a integração. Cada bloco pode ser entregue isoladamente após suas dependências, desde que não exponha um modelo global incompleto.

Antes da execução, revisar particularmente regras propostas de ranking após entrada/saída, atribuição a múltiplos servidores, conquista de primeiro acerto, importação histórica, critério de escolha em conflitos, spoiler, recompensas e atividades. Os casos históricos só podem ser fechados após auditoria real, e devem interromper a migração quando faltarem regras. Não estimar prazo até medir capacidade e dados.
