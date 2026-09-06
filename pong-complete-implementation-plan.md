# PONG - Plano completo de implementação

Data: 2026-09-02

Repositórios envolvidos:

- Activity frontend: `marquinhos-activity-client`
- API e servidor realtime: `../marquinhos-api`

## 1. Objetivo

Evoluir o Pong atual para uma plataforma completa de modos Pong dentro da Discord Activity, preservando autoridade integral no servidor e cobrindo:

- 1v1 clássico com física baseada no ponto de impacto.
- Partida única, melhor-de-3 e melhor-de-5.
- Lobby por instância/canal da Activity, ready-check, espectadores e reconexão.
- Controles desktop e toque direto em mobile.
- Doubles 2v2, Quadrapong/Elimination, Superpong, Rebound e Breakout.
- Multiball, power-ups, bricks, arena circular, spin/gravity, air-hockey e cooperativo.
- Visual neon, feedback audiovisual e requisitos de acessibilidade.
- Rating Glicko-2, leaderboards e torneios round-robin, double elimination e Swiss + top-4.

O histórico do jogo na seção 1 do guia é contexto editorial, não comportamento de software. Ele pode aparecer em uma tela de créditos/sobre, mas não bloqueia nenhuma fase funcional.

## 2. Premissas e decisões obrigatórias

### 2.1 Escopo

Este plano interpreta "todas as features" literalmente para os modos e sistemas jogáveis citados. Os itens entram em marcos independentes para evitar que uma regressão em uma variante bloqueie ou contamine o 1v1 competitivo.

### 2.2 Compatibilidade

- O protocolo realtime será substituído por uma versão nova e coordenada entre frontend e API.
- Não será mantido decoder, encoder ou fallback para o protocolo anterior.
- Frontend e API deverão ser publicados de forma coordenada; versões incompatíveis devem recusar a conexão com erro explícito.

### 2.3 Autoridade e simulação

- O servidor continua sendo a única autoridade sobre física, posições, colisões, placar, vidas, power-ups, fases e resultados.
- O cliente envia intenção de movimento e ações, nunca posição final, colisão, ponto, vida ou vencedor.
- A simulação roda a 120 Hz com passo fixo.
- Snapshots são publicados a 25 Hz, desacoplados do loop de física.
- Não será usado deterministic lockstep.
- O servidor usa colisão analítica/swept collision para impedir tunneling sem depender do frame rate.

### 2.4 Modos ranqueados

Misturar 1v1 clássico, partidas com power-ups e Quadrapong no mesmo rating é uma má ideia: as distribuições de habilidade e aleatoriedade não são comparáveis. Portanto:

- Pool `classic-1v1`: somente regras clássicas padronizadas, sem power-ups.
- Pool `quad-elimination`: somente arena quadrada padronizada, sem modificadores aleatórios.
- Variantes, cooperativo, bot, hot-seat e partidas customizadas são casuais.
- Doubles começa casual; rating de equipe exige uma política própria e não deve ser inferido do rating individual sem aprovação posterior.

### 2.5 Doubles

- Cada equipe possui duas raquetes em profundidades diferentes, separadas no eixo perpendicular ao gol.
- As duas raquetes percorrem o eixo inteiro, respeitando a lacuna de canto.
- A bola colide primeiro com a raquete mais próxima em seu trajeto.
- A equipe compartilha placar, game e série.
- Essa decisão evita sobreposição ambígua de duas raquetes no mesmo plano e evita restringir cada jogador a apenas metade do campo.

### 2.6 Desconexões

- Saída explícita durante uma partida conta como abandono.
- Queda de rede mantém o slot por 30 segundos e pausa 1v1/doubles.
- Reconexão restaura o slot pelo Discord user ID e continua o mesmo estado.
- Timeout após a partida começar resulta em derrota por abandono no ranqueado.
- Antes do primeiro rally, queda simultânea ou falha de servidor resulta em no-contest.
- Em Quadrapong casual, timeout converte o lado em parede ou IA conforme a opção escolhida no lobby.

## 3. Diagnóstico do estado atual

### 3.1 Já existe

- `../marquinhos-api/src/services/activity/pong/PongEngine.ts` executa física no servidor, acelera a bola, limita velocidade e faz uma forma de swept collision no plano X da raquete.
- `../marquinhos-api/src/services/activity/pong/PongSession.ts` possui loop fixo de 8 ms, sequência de input, snapshots binários, bot, hot-seat, restart e grace period de 30 segundos.
- `../marquinhos-api/src/realtime/PongRoom.ts` autentica tokens, limita inputs, atribui dois lados e transforma o terceiro participante em espectador.
- `src/games/pong/components/PongCanvas.tsx` renderiza com PixiJS, prevê o movimento imediato da raquete, interpola estados, possui partículas, glow, trail, squash, screen shake e SFX.
- O frontend já possui menus de modo, dificuldade, som e placares 5/11/21.
- A Activity já usa `instanceId` no room key, o que fornece a base para lobby por instância Discord.

### 3.2 Existe parcialmente, mas precisa ser corrigido

- O loop atual usa 8 ms, aproximadamente 125 Hz, e transmite snapshot em todo tick; simulação e broadcast ainda não estão desacoplados.
- A sequência de input é reconhecida no snapshot, mas o frontend não mantém e reaplica uma fila de inputs não confirmados.
- A previsão atual apenas integra a direção local e suaviza a correção autoritativa.
- A interpolação usa apenas os dois últimos pacotes e tempo de chegada; não existe buffer intencional de aproximadamente 100 ms baseado no relógio do servidor.
- A colisão atual inverte/acelera a velocidade e aplica spin da raquete, mas não calcula o ângulo pela posição de impacto normalizada.
- O saque usa `maxAngle = 0`, portanto toda bola sai perfeitamente horizontal.
- As raquetes alcançam os cantos; a lacuna vulnerável não existe.
- O ponto reseta a bola imediatamente; não existe fase `point-scored`, pausa visual ou countdown de saque.
- O espectador existe, mas não há lobby, ready-check, host, seleção compartilhada nem fila para o próximo game.

### 3.3 Não existe

- Input por target position e toque direto.
- Fases completas da partida e série.
- Doubles, arenas de quatro jogadores, cooperativo e variantes.
- Entidades múltiplas de bola, raquete, brick, obstáculo, shield e power-up.
- Rating, leaderboard específico de Pong e torneios.
- Teste automatizado sob latência/jitter/perda e teste responsivo mobile do fluxo completo.

## 4. Modelo de domínio proposto

### 4.1 Tipos principais

Criar `../marquinhos-api/src/services/activity/pong/PongTypes.ts` e espelhar apenas os tipos públicos necessários em `src/games/pong/types.ts`.

`PongRulesetId`:

- `classic-1v1`
- `doubles-2v2`
- `quad-elimination`
- `superpong`
- `rebound`
- `breakout`
- `brick-battle`
- `multiball`
- `powerup-battle`
- `radial-solo`
- `radial-duel`
- `pong-tennis`
- `air-hockey`
- `coop-keep-alive`

`PongArenaKind`:

- `rectangular`
- `square`
- `volleyball`
- `breakout`
- `circular`
- `air-hockey`

`PongMatchPhase`:

- `lobby`
- `countdown`
- `serving`
- `rally`
- `point-scored`
- `game-over`
- `series-over`
- `paused-disconnect`
- `no-contest`

`PongMatchConfig` deve conter:

- ruleset e arena.
- target score: 7, 10, 11, 15 ou 21.
- série: 1, 3 ou 5 games.
- ranked/casual.
- número de vidas no modo elimination.
- quantidade máxima de bolas.
- power-ups habilitados.
- política após timeout no modo 4-player: wall ou AI.
- seed autoritativa para aleatoriedade reproduzível em testes.

### 4.2 Entidades

`PaddleState`:

- ID numérico estável no match.
- slot do jogador, equipe e lado/segmento defendido.
- posição no eixo, velocidade e target normalizado.
- tamanho base e tamanho atual.
- speed multiplier.
- shield count.
- efeitos ativos com tempo de expiração.

`BallState`:

- ID estável.
- posição e velocidade.
- raio e speed multiplier.
- spin, gravidade e dono do último toque.
- estado sticky e paddle que a reteve.

`BrickState` e `ObstacleState`:

- ID, bounds/geometria, resistência e estado ativo.
- tipo de colisão e efeito gerado.

`PlayerSlotState`:

- slot, Discord user ID, display name e avatar obtidos do token assinado.
- status connected/ready/spectator/eliminated.
- input sequence reconhecida.
- score, lives, games won e placement.

## 5. Regras detalhadas por modo

### 5.1 Classic 1v1

- Campo retangular, center line cosmética, paredes sólidas em cima/baixo e gols abertos à esquerda/direita.
- Raquete com 12–15% da altura do campo e largura configurável.
- Clamp com margem vulnerável de 3% da altura em cada canto.
- Offset de impacto: `(impactAxis - paddleCenter) / (paddleLength / 2)`, limitado a `[-1, 1]`.
- Offset mapeado para ângulo máximo configurável de 60 graus a partir da horizontal.
- Componente horizontal mínima aplicada depois de ângulo, spin e cap de velocidade.
- Velocidade cresce por hit até o máximo; reseta no ponto.
- Saque parte do centro com ângulo aleatório limitado, nunca próximo da vertical, em direção a quem sofreu o ponto.
- Ponto atualiza o HUD imediatamente, dispara evento único, pausa brevemente e inicia novo saque.
- Primeiro a target score vence sem win-by-2.

### 5.2 Série competitiva

- `bestOf=1`, `3` ou `5`.
- Cada game usa first-to-7 ou first-to-11 no preset competitivo.
- Um game termina imediatamente no target score.
- A série termina quando alguém alcança `ceil(bestOf / 2)` games.
- O servidor mantém score do game, games da série e índice do game atual.
- O resultado persistido e o rating são calculados uma única vez no fim da série, não a cada game.

### 5.3 Doubles 2v2

- Quatro slots divididos em duas equipes.
- Duas raquetes por lado em planos de profundidade diferentes.
- Cada jogador controla apenas sua raquete.
- Ambos podem devolver a bola e compartilham score/game/série.
- Queda de um jogador pausa a partida durante o grace period.
- O lobby não inicia sem quatro ready states, salvo se o host preencher uma vaga com bot em partida casual.

### 5.4 Quadrapong / Elimination

- Arena quadrada com uma raquete por lado.
- Cantos são bumpers sólidos para eliminar ambiguidade de gol.
- Cada participante começa com N vidas.
- Sair pelo lado defendido remove uma vida daquele slot.
- Participante sem vidas é eliminado e seu lado vira parede.
- Último participante vivo vence.
- O último toque é registrado para estatísticas, mas não muda quem perde a vida.
- Power-up global de reverse controls afeta todos os slots ativos pelo mesmo período.

### 5.5 Superpong

- Cada lado controla duas ou três raquetes em profundidades diferentes.
- Todas respondem à mesma intenção do jogador, respeitando seus próprios bounds.
- Quantidade, profundidade e tamanho são definidos por preset autoritativo.
- A seed do match define qualquer disposição aleatória para permitir replay de testes.

### 5.6 Rebound

- Arena de volleyball com dois lados, piso, teto e obstáculo central semelhante a uma rede.
- Cada jogador controla uma raquete horizontal em sua metade.
- Gravidade atua na bola.
- A bola pode cruzar acima da rede; contato com o piso concede ponto ao outro lado.
- O saque alterna para quem sofreu o ponto.

### 5.7 Breakout

- Um jogador controla uma raquete horizontal na base.
- Parede de bricks ocupa a região superior.
- Bricks desaparecem após sua resistência chegar a zero.
- Velocidade cresce em faixas conforme a porcentagem de bricks removidos.
- Contato com a parede traseira aplica shrink temporário à raquete.
- A rodada termina ao limpar todos os bricks ou perder a bola conforme o preset.

### 5.8 Multiball

- O servidor suporta IDs independentes para duas ou mais bolas.
- Cada bola pode colidir e pontuar apenas uma vez antes de ser removida/resetada.
- Eventos incluem `ballId` para impedir SFX/partículas duplicados.
- O preset define se todas as bolas reaparecem juntas no ponto ou se a rodada continua até a última bola sair.

### 5.9 Power-up battle

- Spawn, coleta, duração e efeitos são definidos no servidor.
- Grow/shrink altera tamanho com limites seguros.
- Speed boost/slow altera velocidade máxima da raquete, não a posição diretamente.
- Sticky prende uma bola; `release` com Space/tap dispara usando o offset/target atual.
- Extra paddle cria entidade temporária associada ao mesmo slot.
- Reverse controls inverte o eixo/target no servidor e publica indicador de estado ao cliente.
- Shield bloqueia uma concessão e é consumido.
- Extra life somente aparece em modos com vidas.
- Partidas com power-ups são casuais.

### 5.10 Brick battle

- Fileira ou grade central de bricks persiste durante o game.
- Ambos os lados removem os mesmos bricks por colisão.
- Os gols e o placar clássico continuam ativos.
- O estado dos bricks faz parte do snapshot e do reset do game.

### 5.11 Circular/radial

- Posição de raquete é um ângulo; tamanho é um arco.
- Solo: um arco protege a circunferência e o score é tempo/streak.
- Duel: dois arcos ocupam setores distintos e cada saída é atribuída ao setor desprotegido correspondente.
- Colisão usa círculo versus arco, normal radial e offset tangencial para definir a rebatida.
- Mobile rotaciona a câmera para colocar o setor do jogador na parte inferior.

### 5.12 Pong tennis

- O impacto transfere spin proporcional à velocidade tangencial da raquete.
- Gravidade curva a trajetória entre colisões.
- O cap de velocidade e a componente mínima útil são reaplicados depois do spin.
- Curved paddles usam normal local na colisão, não reflexão horizontal fixa.

### 5.13 Air-hockey

- Puck substitui a bola visualmente e fisicamente.
- As quatro bordas podem conter gols abertos.
- Dois a quatro participantes defendem lados/objetivos definidos pelo preset.
- Bumpers resolvem os cantos que não pertencem a um gol.
- O placar é por gols, sem regras de lives salvo preset separado.

### 5.14 Cooperativo keep-it-alive

- Um a quatro participantes protegem segmentos da arena.
- Não existe adversário nem corrida de pontos.
- O servidor mede duração, rally hits e melhor streak compartilhado.
- A rodada acaba quando a bola sai por qualquer segmento não defendido.
- O resultado cooperativo não afeta rating competitivo.

## 6. Arquitetura da API e realtime

### 6.1 Separação de módulos

Refatorar o Pong atual nos seguintes arquivos:

- `../marquinhos-api/src/services/activity/pong/PongTypes.ts` (novo): domínio compartilhado no servidor.
- `../marquinhos-api/src/services/activity/pong/PongRulesetRegistry.ts` (novo): presets, validação e capabilities habilitadas.
- `../marquinhos-api/src/services/activity/pong/PongPhysics.ts` (novo): geometria, swept collisions, normals e integração.
- `../marquinhos-api/src/services/activity/pong/PongEngine.ts`: fases, entidades, score e delegação de física.
- `../marquinhos-api/src/services/activity/pong/PongBotAI.ts`: IA por topologia compatível.
- `../marquinhos-api/src/services/activity/pong/PongSession.ts`: lobby, slots, série, loop, snapshots e lifecycle.
- `../marquinhos-api/src/services/activity/pong/pongProtocol.ts`: encoder versionado.
- `../marquinhos-api/src/realtime/PongRoom.ts`: adapter Colyseus, autenticação e mensagens.

### 6.2 Loop

- Usar acumulador com `SIMULATION_DT_MS = 1000 / 120`.
- Executar múltiplos passos para catch-up com teto de 250 ms.
- Manter acumulador independente para snapshot de 40 ms.
- Não enviar snapshot em cada passo de física.
- Pausar integração física em `lobby`, `point-scored`, `game-over`, `series-over` e `paused-disconnect`.
- Usar relógio monotônico para simulação e timestamps do protocolo.
- Injetar RNG e clock em testes.

### 6.3 Lobby

- Room key multiplayer continua ancorada em `instanceId` e, quando aplicável, `roomId` de torneio.
- Adicionar `channelId` ao `DiscordIdentity`, request de sessão e token assinado quando disponível no Embedded App SDK.
- Primeiro participante elegível vira host.
- Host escolhe ruleset, preset, target, série e política de timeout.
- Mudança de configuração invalida ready de todos.
- Servidor valida configuração contra o registry; cliente não envia config arbitrária.
- Slots excedentes entram como espectadores.
- Espectadores podem escolher fila para o próximo match, mas não entram no rally em andamento.
- Saída do host transfere host para o participante conectado mais antigo.

### 6.4 Mensagens cliente -> servidor

`input`:

- `seq`: inteiro monotônico por slot.
- `axis`: `-1`, `0` ou `1` para teclado.
- `target`: posição normalizada `0..1` para pointer/touch.
- `action`: `release` quando sticky estiver ativo.

`lobby_config`:

- Apenas host.
- Contém IDs de presets aceitos; valores são normalizados no servidor.

`ready`:

- Booleano do próprio jogador.

`spectator_queue`:

- Opt-in/opt-out para o próximo match.

`restart`:

- Mantém votação de rematch em casual; torneio cria o próximo confronto pelo serviço competitivo.

`leave`:

- Saída explícita, distinta de perda de transporte.

### 6.5 Validação e anti-cheat

- Rejeitar NaN, Infinity, campos desconhecidos relevantes, targets fora de bounds e seq regressiva.
- Limitar input a 120 mensagens por segundo por conexão.
- Ignorar side/slot informado pelo cliente fora do hot-seat; ownership vem do token/conexão.
- Aplicar paddle speed e aceleração no servidor ao perseguir target.
- Espectador não pode enviar input, ready de jogador, restart vote ou config.
- Placar, vidas, efeitos e resultado nunca têm handlers de escrita pelo cliente.
- Resultados e ratings são gravados diretamente pela `PongSession` com match ID idempotente.

## 7. Protocolo realtime v2

### 7.1 Snapshot binário

Substituir o layout fixo atual por um layout versionado com:

- Protocol version.
- Snapshot sequence.
- Server simulation timestamp.
- Phase e phase remaining time.
- Ruleset/arena ID.
- Game index, best-of e target score.
- Score por equipe/slot e games won.
- Ack sequence por slot.
- Lista de paddles.
- Lista de balls.
- Lista compacta/bitset de bricks.
- Obstacles e power-ups ativos.
- Lives, elimination state e winner/placement.
- Event sequence mais recente.

O encoder e decoder devem validar tamanho e quantidade máxima de entidades antes de ler/escrever o buffer.

### 7.2 Eventos confiáveis em JSON

Manter fora do snapshot os eventos discretos:

- `init`: identidade do slot, roster, config pública, versão e capabilities.
- `lobby_state`: host, ready, slots, espectadores e config.
- `point_scored`.
- `paddle_hit`.
- `brick_destroyed`.
- `powerup_collected` e `effect_expired`.
- `player_disconnected` e `player_reconnected`.
- `game_won`, `series_won` e `no_contest`.
- `protocol_error`.

Cada evento de gameplay recebe sequence/ID para deduplicação no cliente.

### 7.3 Contrato cruzado

- Criar golden fixtures idênticas em `../marquinhos-api/tests/pongProtocol.test.ts` e `src/games/pong/protocol.test.ts`.
- Testar bytes, offsets, endianess, limites de arrays e buffers truncados.
- Falhar imediatamente quando `protocolVersion` divergir.

## 8. Netcode no frontend

### 8.1 Novos módulos

- `src/games/pong/protocol.ts`: decoder v2 sem lógica visual.
- `src/games/pong/netcode.ts` (novo): snapshot buffer, clock offset, interpolação, extrapolação e reconciliação.
- `src/games/pong/controls.ts` (novo): teclado, pointer, touch e transformação da câmera local.
- `src/games/pong/netcode.test.ts` (novo).
- `src/games/pong/controls.test.ts` (novo).

### 8.2 Snapshot buffer

- Guardar snapshots ordenados por server timestamp e sequence.
- Estimar offset entre relógio local e servidor sem usar apenas arrival time.
- Renderizar remote paddles, balls e obstacles em `serverNow - 100 ms`.
- Interpolar entre snapshots que cercam o render timestamp.
- Extrapolar linearmente no máximo 100 ms quando o próximo snapshot atrasar.
- Congelar na última posição segura depois do limite; não extrapolar através de score/phase events.
- Descartar snapshots antigos, duplicados ou fora de ordem.

### 8.3 Predição local

- Registrar cada input com seq, tipo, valor, instante e duração aplicada.
- Aplicar o input imediatamente à raquete local com as mesmas regras de speed/clamp conhecidas pelo cliente.
- Ao receber ack, remover inputs confirmados.
- Restaurar a posição autoritativa do snapshot.
- Reaplicar, em ordem, todos os inputs ainda não reconhecidos.
- Suavizar apenas erro residual pequeno; hard snap somente em reconexão, mudança de fase ou erro acima do limite.
- Nunca prever score, power-up, colisão ou vencedor.

### 8.4 Predição da bola

- Primeiro marco usa somente interpolation/extrapolation.
- Depois que os testes de 100–150 ms estiverem estáveis, prever movimento entre colisões conhecidas.
- Eventos autoritativos de hit, wall, brick e point corrigem a trajetória.
- O efeito visual pode antecipar movimento, mas SFX/score continuam dirigidos por evento do servidor.

## 9. Frontend, UX e acessibilidade

### 9.1 Fluxo de telas

Atualizar `src/games/pong/pongRoutes.tsx` e `src/games/pong/PongGame.tsx` para:

1. Menu principal.
2. Seleção casual/ranked/tournament.
3. Seleção de modo/variante.
4. Configuração permitida pelo preset.
5. Lobby/ready-check.
6. Partida.
7. Resultado do game/série.
8. Rematch, próximo confronto ou retorno ao lobby.

Criar:

- `src/games/pong/components/PongLobby.tsx`.
- `src/games/pong/components/PongCompetition.tsx`.
- `src/games/pong/components/PongHud.tsx`.
- `src/games/pong/components/PongResults.tsx`.

### 9.2 Canvas

Refatorar `src/games/pong/components/PongCanvas.tsx` para consumir uma render state genérica:

- Renderizar arena retangular, quadrada, volleyball, breakout, circular e air-hockey.
- Renderizar 1–4 jogadores, múltiplas raquetes, múltiplas bolas, bricks, obstacles, shields e pickups.
- Manter center line apenas nos presets apropriados.
- Usar camera transform por slot sem alterar coordenadas autoritativas.
- Preservar neon, glow, particles, trails e screen shake existentes.
- Reduzir/desabilitar shake, trail intenso e flashes quando `prefers-reduced-motion` estiver ativo.
- Não inferir colisão por overlap visual para tocar SFX; usar event IDs do servidor.

### 9.3 Mobile

- Pointer/touch drag funciona em toda a metade/setor pertencente ao jogador.
- Converter coordenada visual para target normalizado após camera rotation.
- Usar pointer capture e tratar cancel/blur para não deixar input preso.
- Em 1v1, rotacionar campo para a raquete local ficar embaixo quando isso melhorar ergonomia.
- Em Quadrapong/radial, sempre colocar o lado/setor local na parte inferior.
- Não adicionar joystick nem tilt.
- Sticky usa botão de ação icônico acessível e tap explícito para release.

### 9.4 HUD e feedback

- Score, lives, games da série e phase ficam fora da área de colisão e sempre visíveis.
- Exibir nome/slot/posição além de cor.
- `point_scored` produz flash curto, som e pausa antes do saque.
- `game_won` e `series_won` têm feedback distinto.
- Spectator badge, reconnect countdown e status de waiting ficam visíveis.
- Power-ups ativos mostram ícone e duração, sem depender apenas de cor.

### 9.5 Acessibilidade

- Paleta com contraste WCAG adequado contra a quadra.
- Slot identificado por posição, label e forma/marker, não só por cor.
- Região `aria-live="polite"` anuncia mudanças de score, game, lives, reconnect e vencedor; não anuncia frames.
- Lobby, settings, leaderboard e bracket são totalmente navegáveis por teclado.
- Focus states continuam visíveis.
- Canvas recebe alternativa textual com score e phase atuais.
- Atualizar `src/i18n/locales/pt-BR/pong.json` para todos os estados e modos.

## 10. Persistência e competição

### 10.1 Migração

Criar `../marquinhos-api/src/database/migrations/003_add_pong_competition.sql` com:

`pong_matches`:

- ID idempotente, guild, instance, room, ruleset, rating pool.
- Ranked flag, target score, best-of e status.
- Start/end timestamps, no-contest reason e winner.

`pong_match_players`:

- Match ID, user ID, slot, team, placement.
- Games won, final score/lives, disconnect result.
- Rating/RD/volatility antes e depois.

`pong_ratings`:

- Guild, user, pool como chave composta.
- Rating inicial 1500.
- Rating deviation inicial 350.
- Volatility inicial 0.06.
- Matches played e updated timestamp.

`pong_tournaments`:

- ID, guild, creator, name, format, ruleset, config, status e timestamps.

`pong_tournament_entries`:

- Tournament, user/team, seed, rating snapshot, status.

`pong_tournament_matches`:

- Tournament, bracket, round, index, participantes, room ID, resultado.
- Ligações de avanço de vencedor/perdedor necessárias para double elimination.

Adicionar índices por guild/pool/rating, tournament/status e match/player.

### 10.2 Rating

Criar `../marquinhos-api/src/services/activity/pong/PongRating.ts`:

- Implementar Glicko-2 com testes de vetores conhecidos.
- Atualizar rating, RD e volatility em uma transação no fim da série.
- Aplicar período de inatividade ao RD.
- Para Quadrapong, transformar placements em resultados pairwise dentro do mesmo rating period; empate vira 0.5.
- Não atualizar rating em no-contest, bot, local, casual ou partida inválida.
- Impedir gravação duplicada pelo match ID.

### 10.3 Serviços e endpoints

Criar:

- `../marquinhos-api/src/services/activity/pong/PongCompetitionService.ts`.
- `../marquinhos-api/src/services/activity/pong/PongTournamentService.ts`.
- `../marquinhos-api/src/controllers/pong.controller.ts`.
- `../marquinhos-api/src/routes/pong.route.ts`.
- `../marquinhos-api/src/schemas/pong.schema.ts`.
- `../marquinhos-api/src/middlewares/activityAuth.ts`.

Endpoints sob `/api/activities/pong`:

- `GET /leaderboard?pool=classic-1v1`.
- `GET /ratings/me`.
- `GET /matches` e `GET /matches/:id`.
- `POST /tournaments`.
- `GET /tournaments` e `GET /tournaments/:id`.
- `POST /tournaments/:id/join`.
- `POST /tournaments/:id/leave`.
- `POST /tournaments/:id/start`.
- `POST /tournaments/:id/check-in`.

Mutações validam o usuário a partir do token Discord; IDs de usuário enviados pelo body nunca definem o ator.

## 11. Torneios

### 11.1 Round robin

- Preset recomendado para até oito participantes.
- Gerar todos-contra-todos com bye quando necessário.
- Pontuação: vitória, derrota e critérios determinísticos de desempate.
- Ordenar classificação por vitórias, confronto direto e diferencial de games.

### 11.2 Double elimination

- Preset recomendado para 8–16 participantes.
- Gerar winners e losers bracket com byes determinísticos.
- Derrota no winners move para o nó correto no losers.
- Segunda derrota elimina.
- Grand final suporta bracket reset quando o vencedor do losers derrota o invicto.

### 11.3 Swiss + top-4

- Usar para grupos maiores ou tempo limitado.
- Número de rodadas calculado pelo tamanho do evento e configurável pelo host.
- Parear por score group, evitar repetição e balancear bye.
- Desempate por Buchholz, vitórias e rating seed.
- Após Swiss, top-4 entra em semifinal e final single elimination.

### 11.4 Seeding e lifecycle

- Capturar rating no fechamento das inscrições.
- Seeds não mudam se o rating mudar durante o evento.
- Check-in remove ausentes antes de gerar bracket.
- Apenas organizador inicia/cancela evento.
- Resultado de match só avança bracket quando gravado pela sessão autoritativa.
- Criar room IDs exclusivos para cada confronto.

## 12. Fases de implementação

### Fase 0 - Contratos, flags e observabilidade

API:

- Criar tipos, registry de rulesets, protocol version e feature capabilities.
- Adicionar logs estruturados para match created/started/point/game/series/disconnect/result.
- Instrumentar duração do tick, catch-up descartado e tamanho dos snapshots.

Frontend:

- Criar tipos públicos e tratamento de protocol mismatch.
- Renderizar somente rulesets habilitados pelo servidor.

Testes/aceite:

- Config inválida é rejeitada.
- Cliente incompatível recebe erro legível.
- Nenhuma feature incompleta aparece no menu.

### Fase 1 - Classic 1v1 correto

API:

- Escrever primeiro testes falhos em `../marquinhos-api/tests/pongEngine.test.ts`.
- Implementar offset angle, 60 graus, componente horizontal mínima, lacuna de canto, saque aleatório injetável, reset de velocidade e fases.
- Separar tick de snapshot.

Frontend:

- Atualizar protocol decoder, phase HUD e eventos de ponto.
- Preservar efeitos visuais existentes usando eventos autoritativos.

Aceite:

- Center hit retorna quase horizontal; edge hit produz ângulo próximo do máximo.
- Bola nunca fica vertical nem atravessa paddle no max speed.
- Saque varia dentro do intervalo e vai para quem sofreu o ponto.
- Score termina exatamente no target, sem win-by-2.
- Snapshot fica entre 20 e 30 Hz enquanto física roda a 120 Hz.

### Fase 2 - Netcode e controles

API:

- Aceitar input axis/target/action e reconhecer seq por slot.
- Mover paddle até target respeitando velocidade.

Frontend:

- Implementar snapshot buffer de 100 ms.
- Implementar ack/reset/replay de inputs.
- Implementar touch drag, camera rotation e pointer lifecycle.

Aceite:

- Sob RTT de 100–150 ms, paddle local responde no mesmo frame.
- Correção comum não produz rubber-banding perceptível.
- Remote paddle/ball continuam suaves com jitter e 5% de perda.
- Target forjado não teleporta paddle.

### Fase 3 - Lobby, espectadores e reconexão

API:

- Implementar host, config, ready, slots, queue e host transfer.
- Consolidar grace period e políticas de abandono/no-contest.
- Restaurar estado pelo Discord user ID.

Frontend:

- Criar `PongLobby`, roster, config host-only, ready-check e spectator state.
- Exibir reconnect countdown e ações permitidas.

Aceite:

- Usuários da mesma Activity instance chegam ao mesmo lobby.
- Terceiro usuário em 1v1 assiste sem obter input ownership.
- Reconnect em até 30 segundos retorna ao mesmo slot e score.
- Saída explícita e queda têm resultados distintos.

### Fase 4 - Séries e Doubles

API:

- Implementar best-of-3/5 e game transitions.
- Generalizar slots/equipes e duas profundidades por lado.

Frontend:

- Mostrar score do game e da série.
- Renderizar quatro paddles e HUD por equipe.

Aceite:

- Série termina somente com maioria de games.
- Quatro usuários controlam apenas seus paddles.
- Sobreposição visual não gera colisão duplicada.
- Resultado persistido é único por série.

### Fase 5 - Quadrapong e cooperativo

API:

- Implementar arena quadrada, paddle segments, bumpers, lives, elimination e placement.
- Implementar keep-it-alive com timer/streak.
- Implementar wall/AI após timeout em 4-player casual.

Frontend:

- Renderizar quatro orientações e camera local.
- Mostrar lives, eliminated state, timer e streak.

Aceite:

- Cada saída é atribuída a exatamente um lado.
- Canto nunca cobra vida de dois jogadores.
- Último vivo vence e placement é estável.
- Cooperativo termina na primeira saída válida e não altera rating.

### Fase 6 - Variantes históricas

API:

- Implementar Superpong, Rebound e Breakout como rulesets independentes.
- Adaptar bots somente onde o ruleset declara suporte.

Frontend:

- Adicionar arenas, HUD e controles próprios de cada ruleset.
- Atualizar How To Play por variante.

Aceite:

- Superpong controla múltiplas raquetes sem ownership extra.
- Rebound aplica gravidade/rede/piso corretamente.
- Breakout remove bricks, acelera por progresso e aplica shrink na parede traseira.

### Fase 7 - Variantes modernas

API:

- Implementar multiball, power-ups, brick battle, radial, Pong tennis e air-hockey.
- Publicar eventos deduplicáveis para todas as entidades.

Frontend:

- Renderizar pickups, effect HUD, arcs, puck, bricks e múltiplas bolas.
- Preservar reduced-motion em todos os efeitos.

Aceite:

- Cada power-up expira e reverte sem drift de estado.
- Multiball não pontua duas vezes com a mesma bola.
- Circular usa colisão radial correta.
- Air-hockey atribui cada gol a um objetivo único.
- Variantes permanecem casuais e não escrevem rating.

### Fase 8 - Rating e leaderboard

API:

- Aplicar migração e implementar Glicko-2 transacional/idempotente.
- Expor leaderboard, rating pessoal e histórico.

Frontend:

- Criar telas de ladder, perfil e histórico.

Aceite:

- Novo jogador inicia em 1500.
- Reprocessar match ID não muda rating duas vezes.
- Pools 1v1 e Quadrapong ficam isolados.
- No-contest e casual não alteram rating.

### Fase 9 - Torneios

API:

- Implementar lifecycle, seeding e os três geradores de formato.
- Integrar conclusão autoritativa ao avanço de bracket.

Frontend:

- Criar inscrição, check-in, standings, bracket e chamada para confronto.

Aceite:

- Geradores cobrem números pares, ímpares e byes.
- Double elimination suporta grand-final reset.
- Swiss não repete adversário quando existe alternativa válida.
- Top-4 nasce da classificação final e não do rating atual.

### Fase 10 - Hardening e rollout

API:

- Rodar testes de engine/session/room/protocol/rating/tournament.
- Rodar soak test com 120 Hz, quatro jogadores, quatro bolas e bricks.
- Verificar memória, tamanho de snapshot, catch-up e cleanup de room.

Frontend:

- Adicionar Playwright, desktop/mobile screenshots e fluxos multi-client.
- Rodar test, typecheck, lint e build.

Aceite:

- Nenhuma room mantém interval/grace timer após dispose.
- Snapshot máximo respeita budget definido no teste.
- Canvas não fica vazio e não há overlap de HUD nos viewports suportados.
- Todos os marcos podem ser habilitados separadamente pelo registry do servidor.

## 13. Arquivos por repositório

### 13.1 API existentes a modificar

- `../marquinhos-api/src/services/activity/pong/PongEngine.ts`
- `../marquinhos-api/src/services/activity/pong/PongBotAI.ts`
- `../marquinhos-api/src/services/activity/pong/PongSession.ts`
- `../marquinhos-api/src/services/activity/pong/pongProtocol.ts`
- `../marquinhos-api/src/realtime/PongRoom.ts`
- `../marquinhos-api/src/services/activity/wsSessionToken.ts`
- `../marquinhos-api/src/services/activity/roomKey.ts`
- `../marquinhos-api/src/schemas/activity.schema.ts`
- `../marquinhos-api/src/controllers/activity.controller.ts`
- `../marquinhos-api/src/routes/activity.route.ts`
- `../marquinhos-api/src/index.ts`
- `../marquinhos-api/tests/pongEngine.test.ts`
- `../marquinhos-api/tests/pongBotAI.test.ts`
- `../marquinhos-api/tests/pongSession.test.ts`
- `../marquinhos-api/tests/pongRoom.test.ts`
- `../marquinhos-api/tests/wsSessionToken.test.ts`
- `../marquinhos-api/tests/activitySchema.test.ts`
- `../marquinhos-api/tests/activityController.test.ts`
- `../marquinhos-api/tests/roomKey.test.ts`

### 13.2 API novos

- `../marquinhos-api/src/services/activity/pong/PongTypes.ts`
- `../marquinhos-api/src/services/activity/pong/PongRulesetRegistry.ts`
- `../marquinhos-api/src/services/activity/pong/PongPhysics.ts`
- `../marquinhos-api/src/services/activity/pong/PongRating.ts`
- `../marquinhos-api/src/services/activity/pong/PongCompetitionService.ts`
- `../marquinhos-api/src/services/activity/pong/PongTournamentService.ts`
- `../marquinhos-api/src/schemas/pong.schema.ts`
- `../marquinhos-api/src/controllers/pong.controller.ts`
- `../marquinhos-api/src/routes/pong.route.ts`
- `../marquinhos-api/src/middlewares/activityAuth.ts`
- `../marquinhos-api/src/database/migrations/003_add_pong_competition.sql`
- `../marquinhos-api/tests/pongProtocol.test.ts`
- `../marquinhos-api/tests/pongPhysics.test.ts`
- `../marquinhos-api/tests/pongRating.test.ts`
- `../marquinhos-api/tests/pongCompetition.test.ts`
- `../marquinhos-api/tests/pongTournament.test.ts`

### 13.3 Frontend existentes a modificar

- `src/discordAuth.ts`
- `src/discordAuth.test.ts`
- `src/games/shared/activitySession.ts`
- `src/games/shared/activitySession.test.ts`
- `src/games/pong/types.ts`
- `src/games/pong/protocol.ts`
- `src/games/pong/hooks/PongMenuFlow.tsx`
- `src/games/pong/hooks/usePongSession.ts`
- `src/games/pong/PongGame.tsx`
- `src/games/pong/pongRoutes.tsx`
- `src/games/pong/components/index.ts`
- `src/games/pong/components/MainMenu.tsx`
- `src/games/pong/components/ModeMenu.tsx`
- `src/games/pong/components/SettingsScreen.tsx`
- `src/games/pong/components/HowToPlay.tsx`
- `src/games/pong/components/PongCanvas.tsx`
- `src/games/pong/components/sfx.ts`
- `src/i18n/locales/pt-BR/pong.json`
- `package.json`

### 13.4 Frontend novos

- `src/games/pong/netcode.ts`
- `src/games/pong/netcode.test.ts`
- `src/games/pong/controls.ts`
- `src/games/pong/controls.test.ts`
- `src/games/pong/protocol.test.ts`
- `src/games/pong/api.ts`
- `src/games/pong/components/PongLobby.tsx`
- `src/games/pong/components/PongCompetition.tsx`
- `src/games/pong/components/PongHud.tsx`
- `src/games/pong/components/PongResults.tsx`
- `playwright.config.ts`
- `e2e/pong.spec.ts`

## 14. Estratégia de testes

### 14.1 Engine e física

- Offset center/edge em todas as orientações.
- Componente horizontal/radial mínima.
- Cap e reset de velocidade.
- Swept collision em max speed.
- Wall, bumper, curved paddle, net, floor, brick e arc.
- Multi-collision ordenada dentro do mesmo tick.
- RNG seeded para saque e power-up.
- Invariantes com centenas de trajetórias seeded: nenhum NaN, bola fora sem score, vida negativa ou hit duplicado.

### 14.2 Session e room

- Lobby host/ready/config/transfer.
- Ownership de 1, 2 e 4 jogadores.
- Espectador sem autorização de input.
- Multi-socket do mesmo usuário.
- Drop, reconnect, timeout, explicit leave e dispose.
- Simulação 120 Hz e broadcast 25 Hz com fake clock.
- Best-of, restart vote, no-contest e idempotência do resultado.

### 14.3 Protocolo

- Golden buffer cruzado.
- Entidades zero/máximas.
- Buffer truncado e versão errada.
- Sequence wrap/ordering definido.
- Snapshot fora de ordem descartado no frontend.

### 14.4 Netcode

- RTT 0, 100 e 150 ms.
- Jitter de 0–30 ms.
- Perda de 5% e burst loss.
- Ack atrasado e snapshot duplicado.
- Replay de target e axis.
- Hard snap em reconnect.
- Extrapolation cap e transição de phase.

### 14.5 Rating e torneios

- Vetores conhecidos de Glicko-2.
- Inatividade, empate pairwise e placements de quatro jogadores.
- Transação e retry do mesmo match.
- Round robin par/ímpar.
- Double elimination com byes e grand-final reset.
- Swiss sem repeat, bye balanceado e desempates.
- Check-in, cancelamento e autorização do organizador.

### 14.6 E2E

- Dois a quatro contexts conectados à mesma instance mock.
- Keyboard, pointer e touch.
- Spectator/reconnect.
- Cada família de arena renderiza pixels não vazios.
- HUD não sobrepõe canvas em desktop e mobile.
- `aria-live`, focus order e reduced-motion.
- Ranked, leaderboard, criação e avanço de torneio.

## 15. Observabilidade e operação

- Logs estruturados incluem match ID, ruleset, room, phase e slot; nunca incluem access token.
- Medir p50/p95/p99 do tick e quantidade de catch-up steps.
- Registrar tamanho p95/máximo dos snapshots por ruleset.
- Contar reconnects, timeouts, forfeits, no-contests e protocol mismatch.
- Registrar divergência média/máxima de reconciliação reportada pelo cliente apenas como telemetria, nunca como autoridade.
- Alertar quando tick exceder budget ou room continuar ativa sem jogadores.

## 16. Ordem de rollout

1. Publicar Classic v2, netcode e mobile em ambiente de teste coordenado.
2. Validar 100–150 ms, jitter e packet loss antes de habilitar multiplayer público.
3. Habilitar lobby, spectator e reconnect.
4. Habilitar séries e doubles.
5. Habilitar Quadrapong e cooperativo.
6. Habilitar variantes históricas uma a uma.
7. Habilitar variantes modernas uma a uma.
8. Habilitar rating somente após estabilidade do preset padronizado.
9. Habilitar torneios primeiro em round robin, depois double elimination e por fim Swiss.

Cada ruleset deve permanecer atrás do registry do servidor até passar seus testes e critérios de aceite. O frontend não deve carregar uma lista própria divergente de modos habilitados.

## 17. Definition of Done global

- Todos os modos e variantes listados na seção 4 possuem ruleset, configuração, UI, física autoritativa, testes e documentação de controle.
- Classic 1v1 atende integralmente às regras de court, paddle, offset bounce, speed cap, minimum component, serve e score.
- Cliente não consegue alterar posição, score, vida, power-up ou resultado fora das regras do servidor.
- Predição local usa ack + replay real; remote entities usam buffer temporal real.
- Mobile usa drag direto e camera orientada ao jogador.
- Lobby, espectadores e reconnect funcionam por Discord identity/instance.
- Ranking usa pools separados e resultados idempotentes.
- Os três formatos de torneio cobrem byes, seeding e avanço.
- Score/phase/lives permanecem legíveis e anunciáveis.
- API e frontend passam test, typecheck, lint, build e E2E.
- Nenhum timer, room, listener Pixi ou conexão permanece após dispose/unmount.

## 18. Rastreabilidade do guia

- Seção 2: target scores, sem win-by-2 e best-of cobertos nas fases 1 e 4.
- Seção 3: court, corner gap, angle mapping, speed cap, minimum component, serve e scoring cobertos na fase 1.
- Seção 4.1: Doubles, Quadrapong, Superpong, Rebound e Breakout cobertos nas fases 4–6.
- Seção 4.2: multiball, todos os power-ups citados, bricks, 4-player, radial, spin/gravity, neon, air-hockey e cooperativo cobertos nas fases 5 e 7.
- Seção 5.1: autoridade, 120/25 Hz, seq, prediction/replay, 100 ms interpolation, extrapolation e ball prediction cobertos nas fases 1–2.
- Seção 5.2: 1v1, 2v2, 3–4 jogadores e cooperativo cobertos nas fases 1, 4 e 5.
- Seção 5.3: lobby por instance, spectators, grace/reconnect e touch direto cobertos nas fases 2–3.
- Seção 5.4: anti-cheat coberto pela validação da room/session.
- Seção 6: Glicko-2, pools, séries, round robin, double elimination, Swiss/top-4 e seeding cobertos nas fases 8–9.
- Seção 7: HUD, feedback de ponto, contraste, identificação não baseada só em cor e screen reader cobertos em todas as fases de frontend.
- Seção 8: a ordem recomendada é preservada, com subdivisões adicionais para tornar cada entrega verificável.
