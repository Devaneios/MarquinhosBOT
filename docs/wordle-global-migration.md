# Auditoria para a jornada global do Terminhos

Esta etapa só lê dados. Ela mede ambiguidades antes de qualquer decisão ou migração e imprime contagens agregadas, sem IDs, palavras ou palpites.

## Executar

Use uma conexão PostgreSQL somente leitura apontada para uma cópia/snapshot representativo:

```sh
bun apps/api/scripts/auditGlobalWordle.ts
```

O processo precisa receber as variáveis de conexão exigidas pelo cliente do banco do projeto. Não execute contra produção sem autorização específica. A conexão de auditoria não deve possuir permissão de escrita.

## O que o relatório conta

- dias com mais de uma resposta cadastrada entre servidores;
- jogadores com sessões e rascunhos repetidos no mesmo dia, separando estados idênticos e divergentes;
- desbloqueios Wordle repetidos por jogador e conquista;
- evidências de desenho repetidas por jogador e desenho;
- jogadores com valores totais de XP diferentes entre registros por servidor.

Os contadores indicam grupos ambíguos, não quantas linhas devem ser apagadas. `identicalSessionGroups` compara o texto armazenado em `guesses`; uma diferença de serialização pode classificar duas sequências equivalentes como divergentes. Antes de consolidar, uma etapa posterior deverá normalizar a estrutura e validar as tentativas contra a resposta do dia.

O XP é compartilhado com outros sistemas e armazenado por jogador e servidor. Divergência não prova erro: os servidores podem ter histórico legítimo diferente. A auditoria sinaliza que migrar saldos para uma identidade global exige uma regra independente da deduplicação de conquistas.

## Estado e limites

Após a ativação da jornada global, use a reconciliação individual para recuperar uma avaliação que falhou depois de um palpite salvo:

```sh
bun apps/api/scripts/reconcileGlobalWordleAchievements.ts --user-id ID --guild-id ID
```

A opção `--guild-id` determina o servidor que recebe o XP das conquistas recém-concedidas. Use o servidor associado à jogada que precisa ser reconciliada. Repetir a operação preserva os desbloqueios e o XP já concedidos. O comando imprime apenas o número de conquistas concedidas.

Não existe nesta etapa uma escolha automática entre respostas, sessões ou saldos conflitantes. O próximo passo é revisar a saída agregada e, se necessário, usar uma ferramenta de análise isolada que gere um manifesto sanitizado por conflito, sem aplicar alterações. A migração só deve ser escrita depois de definir regras para cada classe de divergência, testar repetição e restauração em snapshot e revisar o plano operacional.

## Conversão em snapshot isolado

A ferramenta de conversão utiliza uma transação serializável. Sem opções, ela executa os mesmos passos da conversão e desfaz a transação ao final:

```sh
bun apps/api/scripts/migrateGlobalWordle.ts
```

Para manter os resultados em uma cópia de teste, use `--apply`. Em caso de palavras, sessões ou rascunhos conflitantes, ela retorna categorias de conflito e não aplica nenhuma parte da conversão. O histórico antigo e os saldos de XP existentes não são alterados. Origens das sessões são guardadas e desbloqueios são consolidados sem conceder XP novamente. Evidências inválidas permanecem no histórico antigo e não são copiadas para a coleção global.

## Ordem do corte

1. Restaure um backup representativo em PostgreSQL isolado. Aplique as migrações de schema da versão e aponte `DATABASE_URL` para a cópia. Rode a auditoria com acesso somente leitura, depois rode a conversão sem `--apply` com acesso de escrita.
2. Resolva as divergências apontadas antes de continuar. Repita a conversão na cópia e confira sessões, presença por servidor, desbloqueios e saldos de XP. Teste a restauração do backup e o fluxo no Discord com dois servidores de teste.
3. Na janela autorizada de corte, pare os escritores e workers antigos. Tire um backup do banco congelado, aplique as migrações de schema da versão e repita a auditoria e o dry run com as mesmas versões ensaiadas. A trava do script coordena conversões concorrentes. A parada dos escritores mantém a origem estável.
4. Execute a conversão com `--apply`. Ela grava a linha `legacy-wordle` em `wordle_global_migration_state`, que ativa a jornada global no código novo. As migrações de schema executadas no startup criam a tabela de controle.
5. Inicie API, bot e Activity da versão compatível. Confirme que o mesmo jogador vê a mesma partida em dois servidores e que o progresso aparece somente nas comunidades elegíveis. Teste um anúncio no canal com opt-in e acompanhe as falhas de projeção e entrega no log.
6. Se a validação falhar, mantenha os escritores parados. Antes de restaurar o backup, preserve uma cópia de qualquer escrita aceita depois do corte. Restaure o banco e a versão correspondentes antes de reabrir o tráfego.

Repetir a conversão sobre a mesma origem é seguro. Uma mudança na origem após a conversão faz a ferramenta recusar uma nova execução.

Para aplicar somente as migrações de schema, rode na raiz do repositório com `DATABASE_URL` apontando para o banco da etapa:

```sh
pnpm --filter marquinhos-web-api exec bun -e 'import { runMigrations } from "@marquinhos/database/migrate"; import { closeDefaultDb } from "@marquinhos/database/client"; await runMigrations(); await closeDefaultDb();'
```
