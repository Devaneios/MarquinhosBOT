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

O código da jornada global inclui uma reconciliação individual de conquistas para uso em ambiente de desenvolvimento e testes. Após a ativação futura da jornada global, ela poderá recuperar uma avaliação que falhou depois de um palpite salvo:

```sh
bun apps/api/scripts/reconcileGlobalWordleAchievements.ts --user-id ID --guild-id ID
```

A opção `--guild-id` determina o servidor que recebe o XP das conquistas recém-concedidas; use o servidor associado à jogada que precisa ser reconciliada. Repetir a operação não concede a mesma conquista global nem o mesmo XP novamente. O comando imprime apenas o número de conquistas concedidas. A aplicação em produção depende da migração e ativação da jornada global e não faz parte desta etapa.

Não existe nesta etapa uma escolha automática entre respostas, sessões ou saldos conflitantes. O próximo passo é revisar a saída agregada e, se necessário, usar uma ferramenta de análise isolada que gere um manifesto sanitizado por conflito, sem aplicar alterações. A migração só deve ser escrita depois de definir regras para cada classe de divergência, testar repetição e restauração em snapshot e revisar o plano operacional.
