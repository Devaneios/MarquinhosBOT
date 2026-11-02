# Análise do relatório recebido sobre o Terminhos

## Leitura geral

O relatório organiza as oito ideias, antecipa riscos e propõe uma ordem de trabalho. Porém, várias descrições não correspondem ao produto. Ele trata o Terminhos como plataforma de conteúdo ou aprendizagem com portfólios, fotos, fóruns, quizzes, usuários autenticados e eventos. As propostas deste diretório tratam de um jogo diário de palavras no Discord, com conquistas visuais, partidas individuais, Activity e ranking comunitário.

O texto também afirma que não há decisões formalizadas, embora algumas já tenham sido definidas nesta conversa. As alegações sobre resultados de estudos não têm referências específicas. Assim, roadmap, estimativas e recomendações são hipóteses do relatório, não conclusões comprovadas nem decisões do projeto.

## Correções por tema

| Tema           | O relatório presume                                         | Contexto do Terminhos                                                                                                                                                               |
| -------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vitrine        | Perfil com bio, foto, portfólio e opção para esconder dados | Perfil e conquistas globais; conquistas visíveis; até três destaques junto ao jogador nos rankings por comunidade. Título no ranking parece excessivo. Desenho, se exibido, é fixo. |
| Autoria        | Créditos e metadados em conteúdos publicados                | Preservar autoria e contexto da descoberta de uma conquista e sua figura no tabuleiro. Não há proposta de publicação genérica, geolocalização ou log de edição.                     |
| Álbum          | Galeria de fotos e vídeos                                   | Reunir desenhos descobertos pela comunidade em partidas individuais. Upload de mídia não faz parte da ideia.                                                                        |
| Recompensas    | Badges, pontos, níveis e ranking por contribuições          | O jogo já tem conquistas, XP e rankings. Títulos, molduras, temas e decoração coletiva são ideias expressivas. Pontos novos e reputação não foram propostos.                        |
| Celebrações    | Eventos presenciais/virtuais e "membro do mês"              | Compartilhamento opcional de conquistas e anúncio de marcos coletivos. Eventos e destaque periódico de membros não foram propostos.                                                 |
| Objetivos      | Produzir posts, tutoriais ou arrecadar recursos             | Metas lúdicas alimentadas pelas partidas, como descobrir desenhos ou completar um mosaico.                                                                                          |
| Atividades     | Quizzes, fóruns, cursos e LMS                               | Desafios amistosos, bingo, galeria e conversa após a virada. Não há plano de criar material educativo. Terminhos/Wordle Race fica fora do escopo.                                   |
| Reconhecimento | Curtidas, reputação e avaliações                            | A proposta discute identidade, memória e contribuição sem criar moeda prematuramente. Curtidas e notas não foram propostas. XP deve ser analisado separadamente.                    |
| README         | Arquivo sem propostas                                       | O índice deste diretório reúne propostas e decisões; o README do repositório descreve o aplicativo.                                                                                 |

## Decisões já tomadas

- Partida, progresso, conquistas e perfil são globais por jogador, em qualquer servidor.
- O servidor delimita o ranking da comunidade. Abrir ou jogar o Terminhos ali registra participação; jogadores de outros servidores não entram automaticamente.
- Conquistas são visíveis. A seleção global destaca até três no ranking.
- Título não ocupa a linha do ranking neste momento.
- A evidência de desenho, se exibida, é fixa.
- Dados atuais são associados ao servidor; a migração ainda precisa de análise e regras próprias.

Veja [01-vitrine-pessoal.md](01-vitrine-pessoal.md) para decisões e perguntas em aberto.

## Recomendações que não devemos tratar como requisitos

**Criar contas e perfis com bio.** O projeto já usa identidades do Discord. A ideia de perfil não implica senha, cadastro paralelo, biografia ou upload de foto.

**Dar controle para esconder conquistas.** Isso contradiz a decisão de visibilidade. Ainda é preciso tratar publicações em canais e pistas sobre a palavra ativa, sem esconder conquistas obtidas.

**Moderar uploads.** Riscos de direitos de imagem, armazenamento e fotos impróprias partem de uma galeria de mídia que não foi proposta. Álbum de desenhos tem outros riscos: crédito, pistas, dados incompletos e vínculo de contribuição com a comunidade.

**Adicionar gamificação ampla.** O jogo já tem conquistas, XP e rankings. Níveis, curtidas e pontos por contribuição ampliariam o sistema sem necessidade demonstrada. Antes, identificar o problema que os recursos existentes não resolvem.

**Tratar as fases como dependências técnicas.** O relatório assume que atividades dependem de pontos e badges. Um cartão pode ser explorado sem moeda; perguntas após a virada não precisam de XP. A migração global é uma fundação real, mas precisa de projeto próprio.

**Adotar o prazo de 12–18 meses.** Não há capacidade da equipe, escopo validado ou estimativas verificáveis que sustentem o prazo. O cronograma e suas fases também não formam um compromisso claro. Não usar essas datas como roadmap.

## O que o relatório acrescenta

Pilotos pequenos, critérios claros, registro de limitações, participação de jogadores na criação de metas e atenção à competição, spam e desigualdade entre comunidades são bons cuidados de processo. As fontes citadas, contudo, não estão identificadas com referências completas. Para afirmar que uma mecânica aumenta motivação ou pertencimento, precisamos de estudos específicos ou pesquisa com jogadores do Terminhos.

## Próxima ordem de exploração

Minha recomendação é resolver primeiro as regras da jornada global e do ranking por comunidade, incluindo quais resultados entram quando alguém começa a participar de um servidor. Depois, definir a palavra global por dia e inventariar a migração de sessões, estatísticas, conquistas, XP e evidências. Em seguida, detalhar a vitrine e escolher uma proposta comunitária pequena para explorar. Essa ordem é uma sugestão, não um plano aprovado.
