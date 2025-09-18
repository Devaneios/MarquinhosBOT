# 🎮 Games API Documentation

## Índice
- [Visão Geral](#visão-geral)
- [Arquitetura](#arquitetura)
- [Tipos Principais](#tipos-principais)
- [GameManager](#gamemanager)
- [BaseGame](#basegame)
- [Criando um Novo Jogo](#criando-um-novo-jogo)
- [Integração com Commands](#integração-com-commands)
- [Sistema de XP](#sistema-de-xp)
- [Exemplos de Uso](#exemplos-de-uso)

## Visão Geral

O sistema de Games do MarquinhosBOT oferece uma framework completa para implementar mini games no Discord. O sistema suporta:

- ✅ Jogos single-player e multiplayer
- ✅ Sistema de pontuação e XP
- ✅ Cooldowns personalizáveis
- ✅ Interface rica com embeds e componentes
- ✅ Gerenciamento automático de sessões
- ✅ Integração com sistema de níveis

## Arquitetura

```
src/game/
├── core/
│   ├── GameTypes.ts      # Tipos e enums
│   ├── GameManager.ts    # Gerenciador de sessões
│   ├── GameUtils.ts      # Utilitários para UI
│   └── BaseGame.ts       # Classe abstrata base
├── casino/               # Jogos de cassino
├── knowledge/            # Jogos de conhecimento
├── words/                # Jogos de palavras
├── strategy/             # Jogos de estratégia
├── multiplayer/          # Jogos multiplayer
└── index.ts              # Exports principais
```

## Tipos Principais

### GameType
```typescript
enum GameType {
  // Casino
  BLACKJACK = 'blackjack',
  SLOTS = 'slots',
  ROULETTE = 'roulette',
  // ... outros tipos
}
```

### GameSession
```typescript
interface GameSession {
  id: string;                    // ID único da sessão
  type: GameType;               // Tipo do jogo
  guildId: string;              // ID do servidor
  channelId: string;            // ID do canal
  hostId: string;               // ID do criador
  players: GamePlayer[];        // Jogadores participando
  state: GameState;             // Estado atual
  startedAt: Date;              // Horário de início
  expiresAt: Date;              // Horário de expiração
  config: GameConfig;           // Configurações
  data: any;                    // Dados específicos do jogo
  round?: number;               // Rodada atual
  currentTurn?: string;         // Vez de quem
}
```

### GamePlayer
```typescript
interface GamePlayer {
  userId: string;               // ID do usuário
  username: string;             // Nome do usuário
  score: number;                // Pontuação atual
  status: PlayerStatus;         // Status do jogador
  joinedAt: Date;               // Quando entrou
  data?: any;                   // Dados específicos
}
```

### GameResult
```typescript
interface GameResult {
  sessionId: string;            // ID da sessão
  winners: string[];            // IDs dos vencedores
  losers: string[];             // IDs dos perdedores
  rewards: Record<string, GameReward>; // Recompensas por jogador
  stats: Record<string, any>;   // Estatísticas do jogo
  duration: number;             // Duração em ms
}
```

## GameManager

O `GameManager` é um singleton que gerencia todas as sessões de jogo ativas.

### Métodos Principais

```typescript
// Criar nova sessão
createSession(
  gameType: GameType,
  guildId: string,
  channelId: string,
  hostId: string,
  options?: any
): GameSession

// Buscar sessão
getSession(sessionId: string): GameSession | undefined
getSessionByChannel(channelId: string): GameSession | undefined
getPlayerSession(userId: string, guildId: string): GameSession | undefined

// Gerenciar cooldowns
canUserPlay(userId: string, gameType: GameType): boolean
setUserCooldown(userId: string, gameType: GameType): void
getUserCooldownRemaining(userId: string, gameType: GameType): number

// Controle de sessões
endSession(sessionId: string): boolean
registerGameInstance(sessionId: string, gameInstance: BaseGame): void
getGameInstance(sessionId: string): BaseGame | undefined
```

### Exemplo de Uso
```typescript
const gameManager = GameManager.getInstance();

// Verificar se usuário pode jogar
if (!gameManager.canUserPlay(userId, GameType.BLACKJACK)) {
  const remaining = gameManager.getUserCooldownRemaining(userId, GameType.BLACKJACK);
  return `Aguarde ${remaining}s`;
}

// Criar sessão
const session = gameManager.createSession(
  GameType.BLACKJACK,
  guildId,
  channelId,
  userId
);

// Registrar instância do jogo
const game = new BlackjackGame(session);
gameManager.registerGameInstance(session.id, game);
```

## BaseGame

Classe abstrata que todos os jogos devem estender.

### Métodos Abstratos
```typescript
abstract start(): Promise<void>;
abstract handlePlayerAction(userId: string, action: any): Promise<void>;
abstract getGameEmbed(): EmbedBuilder;
abstract finish(): Promise<GameResult>;
abstract getBaseXpForGame(): number;
```

### Métodos Auxiliares
```typescript
// Gerenciar jogadores
protected addPlayer(userId: string, username: string): boolean
protected removePlayer(userId: string): boolean
protected getPlayer(userId: string): GamePlayer | undefined
protected updatePlayerScore(userId: string, score: number): boolean

// Calcular recompensas
protected calculateRewards(player: GamePlayer, position: number): GameReward
```

## Criando um Novo Jogo

### 1. Definir o Tipo
```typescript
// Em GameTypes.ts
enum GameType {
  // ... outros tipos
  MEU_JOGO = 'meu_jogo'
}

// Adicionar configuração
export const GAME_CONFIGS: Record<GameType, GameConfig> = {
  // ... outras configs
  [GameType.MEU_JOGO]: { 
    maxPlayers: 4, 
    minPlayers: 1, 
    timeLimit: 180 
  }
};

// Adicionar cooldown
export const GAME_COOLDOWNS: Record<GameType, number> = {
  // ... outros cooldowns
  [GameType.MEU_JOGO]: 60 // 60 segundos
};
```

### 2. Implementar a Classe do Jogo
```typescript
// Em meuJogo.ts
import { BaseGame, GameSession, GameResult, PlayerStatus } from '../core/GameTypes';
import { GameUtils } from '../core/GameUtils';

interface MeuJogoData {
  // Defina os dados específicos do seu jogo
  fase: number;
  pontuacao: Record<string, number>;
  // ... outros dados
}

export class MeuJogo extends BaseGame {
  constructor(session: GameSession) {
    super(session);
    this.initializeGame();
  }

  private initializeGame(): void {
    this.session.data = {
      fase: 1,
      pontuacao: {},
      // ... inicializar dados
    } as MeuJogoData;
  }

  async start(): Promise<void> {
    this.session.players.forEach(p => p.status = PlayerStatus.ACTIVE);
    // Lógica de início do jogo
  }

  async handlePlayerAction(userId: string, action: any): Promise<void> {
    // Processar ações do jogador
    const data = this.session.data as MeuJogoData;
    
    switch (action.type) {
      case 'minha_acao':
        await this.processarMinhaAcao(userId, action.valor);
        break;
      // ... outras ações
    }
  }

  getGameEmbed(): EmbedBuilder {
    const data = this.session.data as MeuJogoData;
    
    return GameUtils.createGameEmbed(
      '🎮 Meu Jogo',
      `Fase ${data.fase}\nPontuação: ...`,
      0x00ff00
    );
  }

  // Opcional: Botões de ação
  getActionButtons() {
    return [
      GameUtils.createGameButtons({
        labels: ['🎯 Ação 1', '🎲 Ação 2'],
        customIds: ['meu_jogo_acao1', 'meu_jogo_acao2'],
        styles: [ButtonStyle.Primary, ButtonStyle.Secondary]
      })
    ];
  }

  async finish(): Promise<GameResult> {
    const data = this.session.data as MeuJogoData;
    const rewards: Record<string, any> = {};

    this.session.players.forEach((player, index) => {
      const baseRewards = this.calculateRewards(player, index + 1);
      // Adicionar XP baseado na performance
      baseRewards.xp += data.pontuacao[player.userId] || 0;
      rewards[player.userId] = baseRewards;
    });

    return {
      sessionId: this.session.id,
      winners: [/* IDs dos vencedores */],
      losers: [/* IDs dos perdedores */],
      rewards,
      stats: {
        fase: data.fase,
        // ... outras estatísticas
      },
      duration: Date.now() - this.session.startedAt.getTime()
    };
  }

  protected getBaseXpForGame(): number {
    return 15; // XP base para este jogo
  }
}
```

### 3. Registrar no Sistema
```typescript
// Em games.ts (comando)
import { MeuJogo } from '@marquinhos/game/meuJogo';

function createGameInstance(gameType: GameType, session: any) {
  switch (gameType) {
    // ... outros casos
    case GameType.MEU_JOGO: return new MeuJogo(session);
    default: throw new Error('Game type not implemented');
  }
}

// Adicionar nas opções do comando
.addChoices(
  // ... outras escolhas
  { name: '🎮 Meu Jogo', value: 'meu_jogo' }
)
```

## Integração com Commands

### Estrutura do Comando `/games`
```typescript
// Subcomandos disponíveis
/games list          # Listar jogos
/games play [jogo]   # Iniciar jogo
/games stats         # Estatísticas
/games ranking       # Ranking
```

### Verificações Automáticas
O sistema automaticamente verifica:
- ✅ Cooldowns do usuário
- ✅ Se já está em outro jogo
- ✅ Se há jogo no canal
- ✅ Limites de jogadores

### Fluxo de Criação
```typescript
// 1. Verificar permissões e cooldowns
if (!gameManager.canUserPlay(userId, gameType)) {
  // Mostrar tempo restante
}

// 2. Criar sessão
const session = gameManager.createSession(gameType, guildId, channelId, userId);

// 3. Criar instância do jogo
const gameInstance = createGameInstance(gameType, session);
gameManager.registerGameInstance(session.id, gameInstance);

// 4. Definir cooldown
gameManager.setUserCooldown(userId, gameType);

// 5. Iniciar jogo
await gameInstance.start();
```

## Sistema de XP

### Integração Automática
```typescript
// XP é adicionado automaticamente em:
await XPSystem.addCommandXP(interaction); // Ao iniciar jogo

// E nas recompensas do finish():
const rewards = this.calculateRewards(player, position);
rewards.xp += bonusCalculation;
```

### Cálculo de Recompensas
```typescript
protected calculateRewards(player: GamePlayer, position: number): GameReward {
  const baseXp = this.getBaseXpForGame();
  let xp = baseXp;
  
  // Bônus por posição
  if (position === 1) xp *= 2;        // Vencedor
  else if (position === 2) xp *= 1.5; // 2º lugar
  else if (position === 3) xp *= 1.2; // 3º lugar
  
  // Bônus por dificuldade
  if (this.session.config.difficulty === 'hard') xp *= 1.5;
  else if (this.session.config.difficulty === 'medium') xp *= 1.2;
  
  return {
    xp: Math.floor(xp),
    bonus: position <= 3 ? 100 * (4 - position) : 0
  };
}
```

## Exemplos de Uso

### Jogo Simples (Single-player)
```typescript
// Slots Game - exemplo de jogo solo com RNG
export class SlotsGame extends BaseGame {
  async handlePlayerAction(userId: string, action: any): Promise<void> {
    if (action.type === 'spin') {
      const result = this.generateSlotResult();
      const winnings = this.calculateWinnings(result);
      this.updatePlayerScore(userId, winnings);
    }
  }
}
```

### Jogo Multiplayer (Quiz)
```typescript
// Quiz Game - exemplo com múltiplos jogadores
export class QuizGame extends BaseGame {
  async handlePlayerAction(userId: string, action: any): Promise<void> {
    if (action.type === 'answer') {
      this.session.data.answered[userId] = action.answer;
      
      // Verificar se todos responderam
      const allAnswered = this.session.players.every(p => 
        this.session.data.answered[p.userId]
      );
      
      if (allAnswered) {
        await this.nextQuestion();
      }
    }
  }
}
```

### Jogo por Turnos
```typescript
// Tic Tac Toe - exemplo com turnos
export class TicTacToeGame extends BaseGame {
  async handlePlayerAction(userId: string, action: any): Promise<void> {
    // Verificar se é a vez do jogador
    if (this.session.currentTurn !== userId) return;
    
    if (action.type === 'move') {
      await this.makeMove(action.row, action.col);
      // Alternar turno
      this.session.currentTurn = this.getNextPlayer();
    }
  }
}
```

## GameUtils - Utilitários de Interface

### Criação de Embeds
```typescript
// Embed básico
GameUtils.createGameEmbed(title, description, color);

// Embed de vitória
GameUtils.createWinnerEmbed(winners, gameType);
```

### Componentes Interativos
```typescript
// Botões de ação
GameUtils.createGameButtons({
  labels: ['Ação 1', 'Ação 2'],
  customIds: ['btn_1', 'btn_2'],
  styles: [ButtonStyle.Primary, ButtonStyle.Secondary]
});

// Menu de seleção
GameUtils.createSelectMenu(
  'menu_id',
  'Escolha uma opção',
  options
);
```

### Formatação
```typescript
// Formatação de tempo
GameUtils.formatTime(seconds);
GameUtils.formatCooldownTime(seconds);

// Lista de jogadores
GameUtils.formatPlayerList(players);
GameUtils.formatLeaderboard(players, limit);

// Barra de progresso
GameUtils.createProgressBar(current, max, length);
```

## Configurações e Constantes

### Configurações de Jogo
```typescript
export const GAME_CONFIGS: Record<GameType, GameConfig> = {
  [GameType.MEU_JOGO]: {
    maxPlayers: 8,      // Máximo de jogadores
    minPlayers: 1,      // Mínimo de jogadores
    timeLimit: 300,     // Tempo limite em segundos
    difficulty: 'medium', // Dificuldade padrão
    options: {          // Opções específicas
      allowHints: true,
      rounds: 5
    }
  }
};
```

### Cooldowns
```typescript
export const GAME_COOLDOWNS: Record<GameType, number> = {
  [GameType.MEU_JOGO]: 60  // Cooldown em segundos
};
```

## Debugging e Logs

### Informações de Debug
```typescript
const gameManager = GameManager.getInstance();

// Info geral do sistema
gameManager.debugInfo();

// Estatísticas de sessão
gameManager.getSessionStats(sessionId);

// Limpeza forçada
gameManager.forceCleanup();
```

### Logs Automáticos
O sistema automaticamente:
- 🔄 Limpa sessões expiradas a cada minuto
- 🧹 Remove cooldowns antigos (>24h)
- 📊 Mantém estatísticas de uso

---

## 📝 Resumo

Esta API oferece uma framework robusta e extensível para criar mini games no Discord. Com tipos bem definidos, gerenciamento automático de sessões e integração com o sistema de XP, você pode facilmente adicionar novos jogos seguindo os padrões estabelecidos.

**Principais vantagens:**
- ✅ Sistema completo de gerenciamento
- ✅ Interface rica e responsiva  
- ✅ Multiplayer nativo
- ✅ Integração com XP automática
- ✅ Cooldowns e limitações configuráveis
- ✅ Facilidade para extensão
