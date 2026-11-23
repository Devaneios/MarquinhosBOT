# Prompt para o Claude Design: ícones de achievements do Wordle (Termo)

## Contexto

Preciso dos ícones dos achievements do Wordle em português (estilo Termo) do
bot de Discord "Marquinhos". Eles aparecem em uma lista pequena de conquistas e
em um modal/toast de desbloqueio. Tom: divertido, "servidor de amigos".

## Direção visual

- Estilo: pixel art, 16×16 px, emblema dentro de um anel de 1 px. O emblema
  ocupa 14×14 px. Silhueta única, simples e legível de relance. Preencha cerca
  de 10 a 12 dos 14 px, centralizado.
- Motivo da casa: o tile do Wordle, um quadrado sólido de 2×2 px (verde,
  amarelo ou cinza), com 1 px de espaço entre tiles. Uma linha de 5 tiles tem
  14 px de largura.
- 2 ou 3 cores por emblema, mais no máximo um destaque. Luz vem do canto
  superior esquerdo.
- Dentro de uma família, os tiers repetem o motivo e ficam mais ricos a cada
  nível: o tier 1 é simples, os mais altos ganham cor de acento ou brilho.
  Os detalhes usam apenas as cores do emblema.
- As quatro cores de raridade são exclusivas da borda, em todos os badges:
  `#818384`, `#5facfb`, `#e5484d` e `#ffb000`. Não use essas cores dentro do
  emblema, nem em brilhos, sombras ou detalhes.
- A borda é um molde único fornecido pelo renderer. Sua forma, espessura,
  cantos e posição não mudam entre badges ou tiers; só a cor muda. Não desenhe
  outra borda no blueprint nem prolongue a borda com pixels do emblema.
- Se as cores restantes não bastarem, adicione uma cor distinta à paleta,
  ao mapeamento do renderer e à documentação. Não reutilize um hex reservado.
- Números usam fonte 3×5 px, com 1 px entre dígitos.
- Anel por raridade: comum `#818384`, raro `#5facfb`, épico `#e5484d`,
  lendário `#ffb000`.

### Paleta (hex exatos)

| Nome            | Hex       | Uso                                  |
| --------------- | --------- | ------------------------------------ |
| Fundo / Contorno | `#121213` | Fundo do badge, linhas de corte      |
| Termo Absent    | `#3a3a3c` | Tiles cinza, sombra                  |
| Common          | `#818384` | Exclusivo da borda            |
| Texto           | `#e8e8e8` | Realces, papel, texto, mostradores   |
| Termo Correct   | `#588157` | Tiles verdes, cor principal da marca |
| Accent Claro    | `#98d68f` | Realce claro sobre o verde           |
| Termo Present   | `#c0a054` | Tiles amarelos, ouro, bronze         |
| Warm Cream (`H`) | `#ffe6a3` | Realces de ouro, pergaminho, luz de vela, areia |
| Brown (`S`) | `#79502e` | Sombras de bronze, madeira, couro, terra |
| Violet (`P`) | `#9a74d6` | Gemas, flores, magia, detalhes decorativos |
| Light Violet (`V`) | `#d9b8f5` | Realces violetas, gemas claras, luz refletida |
| Deep Violet (`D`) | `#4b346d` | Sombras violetas, cenas noturnas, tecido escuro |
| Light Teal (`T`) | `#72d7ce` | Água, gelo, vidro, gemas, realces frios |
| Deep Green (`Q`) | `#344f36` | Sombras verdes, folhagem, materiais verdes escuros |
| Deep Teal (`U`) | `#2f7775` | Sombras de teal, água, vidro, gelo |
| Light Gray (`N`) | `#a6a6a8` | Metal, pedra, sombra abaixo do branco |
| Flame Red (`F`) | `#d6432e` | Chamas vermelhas e materiais quentes |
| Light Coral (`E`) | `#ff8f70` | Realces em chamas vermelhas |
| Deep Red (`M`) | `#8b2b27` | Sombras em chamas vermelhas |
| Rare            | `#5facfb` | Exclusivo da borda              |
| Epic            | `#e5484d` | Exclusivo da borda        |
| Legendary       | `#ffb000` | Exclusivo da borda      |

As cores adicionais fazem parte da paleta compartilhada de todos os
emblemas. Rampas do claro ao escuro: verde `L → G → Q`, vermelho `E → F → M`, ouro/marrom
`H → Y → S`, violeta `V → P → D`, teal `W → T → U`, neutros `W → N → A → K`.
Use branco com moderação nos realces. Mantenha 2 ou 3 cores principais por
emblema; as cores de borda continuam exclusivas da borda.

A tabela completa de caracteres está em `STYLE.md`. Os valores RGB vêm de
`palette.gpl`; regenere as referências visuais com
`bun apps/activity/achievement-art/render.ts palette` após alterar a paleta.

## Especificações técnicas

- Entrega: PNG 16×16, fundo `#121213` dentro do anel. Fora do anel, nos cantos,
  transparente. A prévia de revisão também deve ser 16×16, sem ampliação.
- Nome do arquivo: o ID sem o prefixo `wordle_v2_` (ex.: `streak_7.png`).
- Estado bloqueado: versão em escala de cinza do mesmo emblema, anel `#3a3a3c`.
  O achievement secreto mostra só uma silhueta com "?".

## Consistência

Comece por um achievement de cada família (`wins_1`, `streak_7`, `fast_60`,
`pattern_letter_a`, `calendar_week`). Eu valido o estilo, e então você gera o
restante em lote.

## Lista de achievements (ID sem prefixo · nome · condição · raridade)

### Vitórias (`wins`), tiers crescentes
| ID | Nome | Condição | Raridade |
| -- | ---- | -------- | -------- |
| wins_1 | Palavra encontrada | Acertar a palavra do dia pela primeira vez | comum |
| wins_10 | Dez respostas | Acertar em 10 dias | comum |
| wins_50 | Cinquenta descobertas | Acertar em 50 dias | raro |
| wins_100 | Cem soluções | Acertar em 100 dias | épico |
| wins_365 | Ano de respostas | Acertar em 365 dias | lendário |

### Presença (`played`), tiers crescentes
| ID | Nome | Condição | Raridade |
| -- | ---- | -------- | -------- |
| played_1 | Ponto de partida | Mandar um palpite válido em algum dia | comum |
| played_7 | Sete encontros | Palpite válido em 7 dias | comum |
| played_30 | Trinta visitas | Palpite válido em 30 dias | raro |
| played_100 | Presença constante | Palpite válido em 100 dias | épico |
| played_365 | Um ano presente | Palpite válido em 365 dias | lendário |

### Sequência de acertos (`streak`), tiers crescentes
| ID | Nome | Condição | Raridade |
| -- | ---- | -------- | -------- |
| streak_3 | Trinca diária | Acertar 3 dias seguidos | comum |
| streak_7 | Sete acertos seguidos | Acertar 7 dias seguidos | raro |
| streak_14 | Duas semanas certas | Acertar 14 dias seguidos | raro |
| streak_30 | Mês de acertos | Acertar 30 dias seguidos | épico |
| streak_100 | Cem sem pausa | Acertar 100 dias seguidos | lendário |

### Calendário
| ID | Nome | Condição | Raridade |
| -- | ---- | -------- | -------- |
| calendar_week | Agenda preenchida | Jogar todos os dias de uma semana (seg a dom) | raro |
| calendar_month | Mês completo | Jogar todos os dias de um mês | épico |

### Precisão (tentativas)
| ID | Nome | Condição | Raridade |
| -- | ---- | -------- | -------- |
| solved_exactly_1 | Palpite certeiro | Acertar de primeira | raro |
| solved_exactly_2 | Segunda é a certa | Acertar na segunda tentativa | comum |
| solved_exactly_3 | Três tentativas | Acertar na terceira tentativa | comum |
| wins_within_3_10 | Mira treinada | Acertar em até 3 tentativas em 10 dias | raro |
| zero_attempt_solve | Rascunho certeiro | Deixar a palavra certa digitada no rascunho e não enviar palpite até o fim do dia | épico |

### Feedback de cores
| ID | Nome | Condição | Raridade |
| -- | ---- | -------- | -------- |
| all_yellow | Tudo no lugar errado | Palpite com todas as letras amarelas | raro |
| blank_opening | Recomeço em cinza | Começar com palpite todo cinza e acertar mesmo assim | comum |
| mixed_rows | Três cores em sequência | 3 palpites seguidos, antes do certo, cada um com verde, amarelo e cinza | raro |
| blank_twice_then_solved | Duas linhas em branco | Errar tudo em dois palpites seguidos e depois acertar | raro |
| yellow_only_before_solve | Só amarelos | Acertar depois de só fazer palpites inteiros amarelos | épico |
| anagrams_only_before_solve | Anagramas até o fim | Acertar depois de só fazer palpites que são anagramas da resposta | raro |

### Estilo de jogo
| ID | Nome | Condição | Raridade |
| -- | ---- | -------- | -------- |
| improvement | Passo a passo | Acertar em 3+ tentativas, com mais letras verdes a cada palpite | raro |
| near_miss | Faltava uma | Acertar logo depois de um palpite com só uma letra fora do verde | comum |
| near_miss_twice | Por um triz, duas vezes | Dois palpites com só uma letra no lugar errado, sem acertar | raro |
| near_miss_three_times | Por um triz, três vezes | Três palpites com uma letra fora do verde na mesma partida | épico |
| near_miss_four_times | Por um triz, quatro vezes | Quatro palpites com uma letra fora do verde na mesma partida | lendário |

### Velocidade e horário
| ID | Nome | Condição | Raridade |
| -- | ---- | -------- | -------- |
| fast_60 | Vou terminei | Acertar em até 60 s após o primeiro palpite (2+ tentativas) | raro |
| secret_d6a09c31 | Meio minuto (secreto) | Acertar em até 30 s após o primeiro palpite (2+ tentativas) | épico |
| midnight | Primeira hora | Acertar entre 00h e 01h | comum |
| morning | Café com palavras | Acertar entre 05h e 08h | comum |
| late | Antes de dormir | Acertar entre 22h e meia-noite | comum |
| first_solver_1 | Abriu os trabalhos | Ser a primeira pessoa do servidor a acertar o dia | comum |
| first_solver_10 | Sempre chegando cedo | Ser a primeira a acertar em 10 dias | raro |

### Vocabulário
| ID | Nome | Condição | Raridade |
| -- | ---- | -------- | -------- |
| both_lengths | Cinco e seis | Acertar uma palavra de 5 letras e outra de 6 | raro |
| repeated_letters | Letra em dobro | Acertar palavra com letra repetida | comum |
| accented_answer | Com acento | Acertar palavra que se escreve com acento | comum |
| devaneios_rows | DEVANEIOS | Escrever DEVANEIOS com letras verdes na mesma linha, ao longo de vários dias | lendário |

### Desenhos no tabuleiro (o jogador "desenha" a figura com tiles)
Cada um é uma figura em pixel art. Letras e números vêm do desenho em tiles.

| IDs | Nome | Raridade |
| --- | ---- | -------- |
| pattern_letter_a até pattern_letter_z (26) | Letra A … Letra Z | raro |
| pattern_digit_0 até pattern_digit_9 (10) | Número 0 … Número 9 | raro |
| pattern_tetromino_i, o, t, j, l, s, z (7) | Tetraminó I … Z (peças do Tetris) | comum |
| pattern_square_outline | Quadrado vazado | raro |
| pattern_diamond_outline | Losango | raro |
| pattern_cross | Cruz | raro |
| pattern_heart | Coração | raro |
| pattern_arrow_up / down / left / right | Setas | raro |
| pattern_staircase, pattern_staircase_right, pattern_staircase_inverted | Escadinhas | raro |
| pattern_hourglass | Ampulheta | raro |
| pattern_triangle_5, pattern_triangle_6 | Triângulos de base 5 e 6 | raro |
| pattern_hang_loose | Hang loose | raro |
| pattern_middle_finger | Dedo do meio | raro |
| pattern_love_you | Eu te amo | raro |
| pattern_metal_horns | Chifres do metal | raro |

### Coleções
| ID | Nome | Condição | Raridade |
| -- | ---- | -------- | -------- |
| letters_5 | Primeiras letras | Desenhar 5 letras diferentes | raro |
| letters_all | Alfabeto completo | Desenhar as 26 letras | lendário |
| digits_5 | Meia contagem | Desenhar 5 números diferentes | raro |
| digits_all | De zero a nove | Desenhar todos os números | épico |
| tetrominoes_all | Sete peças | Desenhar os 7 tetraminós | raro |
| shapes_5 | Caderno de desenhos | Desenhar 5 formas diferentes | raro |
| shapes_all | Galeria de formas | Desenhar 10 formas diferentes | épico |
