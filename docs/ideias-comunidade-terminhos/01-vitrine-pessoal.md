# Vitrine pessoal e identidade global

## Intenção e estado da proposta

O ranking é uma das principais vitrines do Terminhos, pois aparece com frequência para a comunidade. A proposta é colocar até três conquistas escolhidas pelo jogador junto ao seu nome no ranking e reunir sua trajetória em um perfil único, independente do servidor.

As decisões abaixo foram tomadas na conversa. Os detalhes marcados como proposta ou questão em aberto ainda precisam ser discutidos. Este documento não é uma autorização para implementar ou migrar dados.

## Decisões tomadas

- **Identidade e progresso globais.** O jogador tem uma única jornada no Terminhos. Partida, palpites, estatísticas, conquistas e perfil são os mesmos em qualquer servidor. Ele pode começar a jogar em um servidor e continuar a mesma partida em outro.
- **Servidor como contexto.** O servidor pode ser guardado como informação de origem ou contexto, mas não é parâmetro que identifica ou separa a partida, a coleção ou o perfil do jogador.
- **Uma vitrine global.** O jogador escolhe até três conquistas para destacar. A mesma seleção aparece em todos os servidores. Sua ordem e edição são propostas naturais para essa escolha, ainda a detalhar.
- **Ranking por comunidade.** Cada servidor vê sua própria classificação. Um jogador é considerado participante de uma comunidade quando abre ou joga o Terminhos nela, inclusive se a partida já tiver começado em outro servidor. Jogadores de outras comunidades não entram automaticamente naquele ranking.
- **Conquistas visíveis.** Não haverá uma opção para o jogador esconder suas conquistas. Isso não resolve por si só quando revelar detalhes que possam dar pistas da palavra ativa.
- **Desenho fixo.** Se uma conquista de desenho for exibida com sua evidência, a representação é um registro fixo, não muda automaticamente quando a pessoa encontra outra ocorrência.
- **Título fora da linha do ranking.** Um título nessa linha provavelmente seria informação demais. Um título no perfil continua sendo uma possibilidade, não uma decisão de incluí-lo.

## Experiência imaginada

Ana abre o Terminhos no servidor A e começa a palavra do dia. Mais tarde, abre o jogo no servidor B e encontra os mesmos palpites, podendo continuar de onde parou. Ao abrir o jogo em B, passa a ser considerada participante dessa comunidade segundo a regra acima.

Ana escolhe três conquistas que considera interessantes. No próximo ranking de A ou B em que aparecer, a linha mostra as mesmas conquistas junto a seu nome. Sua posição e os demais jogadores podem ser diferentes, pois cada ranking pertence à sua comunidade.

Alguém consulta o perfil de Ana e vê as conquistas e o detalhe de uma figura destacada. Se houver evidência válida, o desenho apresentado é fixo. Quando não houver evidência histórica, a conquista continua existindo e deve ter uma apresentação compreensível sem inventar um desenho.

## Ranking e apresentação

O ranking diário já é gerado como imagem no Discord e usado tanto no status periódico quanto no encerramento do dia. Também existem outras apresentações e períodos de ranking; é preciso inventariá-los ao detalhar a solução. A linha deve continuar legível e não prejudicar a leitura da posição, nome e resultado.

A proposta visual é usar até três emblemas compactos. No Discord, a imagem é estática: ela não oferece interação individual por emblema. Portanto, o nome e a descrição das conquistas precisam estar acessíveis por outro caminho, como perfil ou coleção. Na Activity, se houver apresentação interativa equivalente, pode-se explorar detalhes ao selecionar o emblema. A aparência e o modo de acesso ainda estão em aberto.

O jogador pode ter menos de três conquistas ou não ter configurado a seleção. A linha deve funcionar nesses casos sem sugerir uma conquista inexistente. Ainda precisamos decidir se a seleção inicial fica vazia ou se o jogo sugere preenchimento, como editar e reordenar os itens e em quais rankings a vitrine aparece.

## Perfil e desenhos

O perfil é único por jogador, não uma composição diferente por servidor. A coleção é visível; decidir como chegar ao perfil é separado da decisão de esconder conquistas. A Activity e o comando de conquistas existente são pontos de acesso possíveis, mas ainda não escolhemos o fluxo.

O registro de desenho já existente guarda uma evidência por jogador, servidor e padrão. No modelo desejado, uma conquista de desenho e sua evidência principal são globais. Uma sugestão para os dados antigos é escolher a evidência válida mais antiga disponível e mantê-la fixa. Essa regra é uma proposta, não uma decisão aprovada: timestamps, empates, dados incompletos e a diferença entre data de ocorrência e data de registro precisam ser examinados. Não devemos afirmar que algo foi a primeira ocorrência histórica quando os dados não sustentarem a afirmação.

Também falta definir se o desenho exibido é sempre a evidência fixa da conquista ou se o jogador escolhe inicialmente um registro que depois permanece fixo. A decisão de usar desenho fixo não exige, por si só, um espaço adicional de desenho separado das três conquistas.

## Palavra ativa e conquistas ocultas

A visibilidade das conquistas não equivale a publicar a resposta do dia. Até cores e formas de um tabuleiro atual podem fornecer pistas. Uma solução possível é exibir o ícone genérico da conquista no ranking e reservar evidências do dia para depois da virada, sem oferecer ao jogador uma opção de esconder a conquista. Precisamos decidir se o ícone, nome ou descrição de qualquer conquista também pode revelar informação indevida.

Há conquistas cujas condições ficam ocultas antes do desbloqueio no comportamento atual. Precisamos distinguir essa mecânica de descoberta da decisão de não esconder conquistas já obtidas: confirmar se condições ainda não desbloqueadas continuam secretas ou se o catálogo inteiro deve ser revelado.

## Consequências para dados e migração

A implementação atual associa sessões, desbloqueios e evidências a jogador e servidor. O objetivo global exige mais do que juntar perfis. A mudança deve preservar a continuidade do jogo e considerar:

- **Partidas duplicadas no mesmo dia.** Um jogador pode ter partidas diferentes em servidores distintos. A regra para escolher ou reconciliar palpites, solução, tentativas e rascunhos ainda não foi definida. Não combinar linhas arbitrariamente nem descartar histórico sem uma decisão informada.
- **Palavras e datas.** Conferir os dados existentes para saber se servidores tiveram respostas diferentes na mesma data. Definir qual palavra será global e como lidar com partidas históricas incompatíveis e uma partida ativa durante a transição.
- **Estatísticas e sequências.** Recalcular ou reconciliar dias, vitórias, sequências e demais indicadores a partir de regras explícitas, evitando contar o mesmo dia duas vezes e sem perder informação histórica sem decisão.
- **Conquistas e XP.** Unificar conquistas repetidas por jogador, preservar datas e evidências, e determinar separadamente como tratar XP já concedido mais de uma vez. Não assumir que remover duplicatas de conquistas autoriza retirar XP.
- **Participação em comunidades.** Decidir se dados antigos de partidas comprovam participação e como tratar a ausência de histórico suficiente. Abrir ou jogar no servidor passa a registrar participação sem dividir a partida global.
- **Ranking.** Definir como dados globais de resultado se relacionam com a comunidade e o período classificados, inclusive quando a pessoa entra em uma comunidade depois de já ter jogado. A regra de participação não determina sozinha quais resultados entram em cada ranking.
- **Transição e recuperação.** Inventariar os dados, definir regras reproduzíveis e auditáveis, preservar origem e um caminho de recuperação, e validar os resultados antes de qualquer migração. Nenhuma migração está aprovada por este brainstorm.

## Questões em aberto para a próxima conversa

1. **Escopo temporal do ranking.** Ao abrir o jogo em uma comunidade, a pessoa entra nos rankings usando todo o seu histórico global, apenas resultados a partir de sua entrada ou outra regra? E um jogador que abre depois de concluir a palavra de hoje aparece no ranking de hoje?
2. **Participação e saída.** A participação dura indefinidamente? O que acontece quando alguém sai do servidor, retorna ou abre o jogo sem fazer uma tentativa?
3. **Palavra diária.** Uma única partida global pressupõe uma palavra compatível entre servidores. Devemos adotar uma única palavra diária global? Como lidar com configurações e históricos existentes?
4. **Seleção da vitrine.** Começa vazia ou preenchida automaticamente? O jogador pode reordenar, retirar ou trocar suas três conquistas a qualquer momento? Quais rankings mostram os emblemas?
5. **Detalhe do desenho.** Qual evidência fixa representa a conquista e como tratar empates ou ausência de evidência? Há um desenho destacado à parte ou apenas os desenhos das conquistas selecionadas?
6. **Visibilidade e spoilers.** Quando o ícone e a evidência de uma conquista obtida na palavra ativa ficam visíveis aos demais? Condições de conquistas ainda não desbloqueadas continuam ocultas?
7. **Perfil.** Como abrir o perfil na Activity e no Discord? Quais informações além de conquistas e estatísticas pertencem à primeira versão? O título ainda é desejado?
8. **Dados históricos.** Como resolver partidas conflitantes, estatísticas, desbloqueios e XP duplicados sem perder história? A resposta deve vir após inventário dos dados e exemplos reais.

## Próximo passo sugerido

Resolver primeiro o significado temporal do ranking e a palavra diária global, pois afetam o comportamento do jogo inteiro. Depois, detalhar a edição e a apresentação da vitrine. A migração deve ser desenhada a partir de um inventário dos dados atuais, não de suposições sobre conflitos.
