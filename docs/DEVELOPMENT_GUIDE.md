# 🛠️ Guia de Desenvolvimento - Games API

Este guia fornece informações detalhadas para desenvolvedores que querem contribuir ou estender o sistema de games do MarquinhosBOT.

## 🚀 Setup do Ambiente

### Pré-requisitos
- Node.js 18+ 
- TypeScript 4.8+
- Discord.js 14.x
- Git

### Instalação
```bash
# Clone o repositório
git clone <repo-url>
cd MarquinhosBOT

# Instale dependências
npm install

# Configure variáveis de ambiente
cp .env.example .env
# Edite .env com suas configurações

# Compile TypeScript
npm run build

# Execute em modo desenvolvimento
npm run dev
```

## 🏗️ Arquitetura Detalhada

### Estrutura de Pastas
```
src/game/
├── core/                   # Sistema base
│   ├── GameTypes.ts       # Tipos e enums
│   ├── GameManager.ts     # Singleton manager
│   ├── GameUtils.ts       # Utilitários UI
│   └── BaseGame.ts        # Classe abstrata
├── casino/                # Jogos de cassino
├── knowledge/             # Jogos de conhecimento
├── words/                 # Jogos de palavras
├── strategy/              # Jogos de estratégia
├── multiplayer/           # Jogos multiplayer
└── index.ts               # Export principal
```

### Fluxo de Dados
```
Discord Command → GameManager → BaseGame → Discord Response
     ↓                ↓            ↓            ↑
User Action → Session Update → Game Logic → Update UI
```

## 🎮 Implementando um Novo Jogo

### 1. Planejamento
Antes de implementar, defina:
- **Tipo**: Single/Multiplayer
- **Mecânica**: Como funciona
- **Interface**: Botões e embeds
- **Recompensas**: Sistema XP
- **Cooldown**: Tempo entre jogos

### 2. Definir Tipos
```typescript
// Em GameTypes.ts
enum GameType {
  MEU_NOVO_JOGO = 'meu_novo_jogo'
}

// Configuração
export const GAME_CONFIGS: Record<GameType, GameConfig> = {
  [GameType.MEU_NOVO_JOGO]: {
    maxPlayers: 4,
    minPlayers: 1,
    timeLimit: 180,
    difficulty: 'medium'
  }
};

// Cooldown
export const GAME_COOLDOWNS: Record<GameType, number> = {
  [GameType.MEU_NOVO_JOGO]: 60 // segundos
};
```

### 3. Criar Interface de Dados
```typescript
// Interface específica do jogo
interface MeuJogoData {
  fase: number;
  pontuacao: Record<string, number>;
  estado: 'preparando' | 'jogando' | 'finalizado';
  configuracao: {
    dificuldade: 'easy' | 'medium' | 'hard';
    rodadas: number;
  };
}
```

### 4. Implementar Classe do Jogo
```typescript
export class MeuNovoJogo extends BaseGame {
  constructor(session: GameSession) {
    super(session);
    this.initializeGame();
  }

  private initializeGame(): void {
    // Inicializar dados específicos
    this.session.data = {
      fase: 1,
      pontuacao: {},
      estado: 'preparando',
      configuracao: {
        dificuldade: this.session.config.difficulty || 'medium',
        rodadas: 5
      }
    } as MeuJogoData;

    // Inicializar pontuação dos jogadores
    this.session.players.forEach(player => {
      this.session.data.pontuacao[player.userId] = 0;
    });
  }

  async start(): Promise<void> {
    // Marcar jogadores como ativos
    this.session.players.forEach(p => p.status = PlayerStatus.ACTIVE);
    
    // Lógica de início específica
    const data = this.session.data as MeuJogoData;
    data.estado = 'jogando';
    
    // Você pode enviar uma mensagem inicial aqui se necessário
  }

  async handlePlayerAction(userId: string, action: any): Promise<void> {
    const data = this.session.data as MeuJogoData;
    
    // Validar se o jogo está ativo
    if (data.estado !== 'jogando') return;
    
    // Validar se é um jogador válido
    const player = this.getPlayer(userId);
    if (!player || player.status !== PlayerStatus.ACTIVE) return;

    // Processar ações específicas
    switch (action.type) {
      case 'escolher_opcao':
        await this.processarEscolha(userId, action.opcao);
        break;
      case 'usar_poder':
        await this.usarPoder(userId, action.poder);
        break;
      default:
        console.warn(`Ação desconhecida: ${action.type}`);
    }
  }

  private async processarEscolha(userId: string, opcao: string): Promise<void> {
    const data = this.session.data as MeuJogoData;
    
    // Lógica específica da escolha
    const pontos = this.calcularPontos(opcao);
    data.pontuacao[userId] += pontos;
    
    // Atualizar score do jogador
    this.updatePlayerScore(userId, data.pontuacao[userId]);
    
    // Verificar se deve avançar fase ou finalizar
    if (this.todasEscolhasFeitas()) {
      await this.proximaFase();
    }
  }

  private calcularPontos(opcao: string): number {
    // Implementar lógica de pontuação
    const pontos = {
      'opcao_a': 10,
      'opcao_b': 20,
      'opcao_c': 5
    };
    return pontos[opcao] || 0;
  }

  private todasEscolhasFeitas(): boolean {
    // Verificar se todos jogadores fizeram suas escolhas
    // Implementar lógica específica
    return true;
  }

  private async proximaFase(): Promise<void> {
    const data = this.session.data as MeuJogoData;
    data.fase++;
    
    if (data.fase > data.configuracao.rodadas) {
      data.estado = 'finalizado';
      // O jogo será finalizado automaticamente pelo sistema
    }
  }

  getGameEmbed(): EmbedBuilder {
    const data = this.session.data as MeuJogoData;
    
    let description = `🎮 **Meu Novo Jogo**\n\n`;
    description += `📊 **Fase:** ${data.fase}/${data.configuracao.rodadas}\n`;
    description += `🎯 **Estado:** ${data.estado}\n\n`;
    
    // Mostrar pontuação atual
    const sortedPlayers = this.session.players.sort((a, b) => 
      (data.pontuacao[b.userId] || 0) - (data.pontuacao[a.userId] || 0)
    );
    
    description += `**Pontuação:**\n`;
    sortedPlayers.forEach((player, index) => {
      const pontos = data.pontuacao[player.userId] || 0;
      const medal = GameUtils.getPositionMedal(index + 1);
      description += `${medal} ${player.username}: ${pontos} pontos\n`;
    });

    // Determinar cor baseada no estado
    const color = data.estado === 'finalizado' ? 0x00ff00 : 0x3498db;
    
    return GameUtils.createGameEmbed(
      '🎮 Meu Novo Jogo',
      description,
      color
    );
  }

  // Opcional: Botões de ação
  getActionButtons() {
    const data = this.session.data as MeuJogoData;
    
    if (data.estado !== 'jogando') return [];

    return [
      GameUtils.createGameButtons({
        labels: ['🎯 Opção A', '🎲 Opção B', '⭐ Opção C'],
        customIds: ['jogo_opcao_a', 'jogo_opcao_b', 'jogo_opcao_c'],
        styles: [ButtonStyle.Primary, ButtonStyle.Secondary, ButtonStyle.Success]
      })
    ];
  }

  async finish(): Promise<GameResult> {
    const data = this.session.data as MeuJogoData;
    const rewards: Record<string, GameReward> = {};

    // Ordenar jogadores por pontuação
    const sortedPlayers = this.session.players.sort((a, b) => 
      (data.pontuacao[b.userId] || 0) - (data.pontuacao[a.userId] || 0)
    );

    // Calcular recompensas
    sortedPlayers.forEach((player, index) => {
      const position = index + 1;
      const baseRewards = this.calculateRewards(player, position);
      
      // Bonus XP baseado na pontuação
      const pontuacao = data.pontuacao[player.userId] || 0;
      baseRewards.xp += Math.floor(pontuacao / 10);
      
      // Bonus adicional para o vencedor
      if (position === 1) {
        baseRewards.xp += 25;
      }
      
      rewards[player.userId] = baseRewards;
    });

    return {
      sessionId: this.session.id,
      winners: sortedPlayers.slice(0, 3).map(p => p.userId), // Top 3
      losers: sortedPlayers.slice(3).map(p => p.userId),
      rewards,
      stats: {
        fasesCompletadas: data.fase,
        totalPontos: Object.values(data.pontuacao).reduce((a, b) => a + b, 0),
        dificuldade: data.configuracao.dificuldade,
        rodadas: data.configuracao.rodadas
      },
      duration: Date.now() - this.session.startedAt.getTime()
    };
  }

  protected getBaseXpForGame(): number {
    return 20; // XP base para este jogo
  }
}
```

### 5. Registrar no Sistema
```typescript
// Em games.ts
import { MeuNovoJogo } from '@marquinhos/game/meuNovoJogo';

// Adicionar no createGameInstance
function createGameInstance(gameType: GameType, session: any) {
  switch (gameType) {
    // ... outros casos
    case GameType.MEU_NOVO_JOGO: return new MeuNovoJogo(session);
    default: throw new Error('Game type not implemented');
  }
}

// Adicionar nas opções do comando
.addChoices(
  // ... outras escolhas
  { name: '🎮 Meu Novo Jogo', value: 'meu_novo_jogo' }
)
```

## 🧪 Testes

### Estrutura de Testes
```bash
tests/
├── unit/
│   ├── GameManager.test.ts
│   ├── GameUtils.test.ts
│   └── games/
│       ├── BlackjackGame.test.ts
│       └── MeuNovoJogo.test.ts
├── integration/
│   ├── GameFlow.test.ts
│   └── Commands.test.ts
└── helpers/
    ├── MockDiscord.ts
    └── GameTestUtils.ts
```

### Exemplo de Teste Unitário
```typescript
// tests/unit/games/MeuNovoJogo.test.ts
import { MeuNovoJogo } from '../../../src/game/meuNovoJogo';
import { GameSession, GameType, PlayerStatus } from '../../../src/game/core/GameTypes';

describe('MeuNovoJogo', () => {
  let game: MeuNovoJogo;
  let session: GameSession;

  beforeEach(() => {
    session = {
      id: 'test-session',
      type: GameType.MEU_NOVO_JOGO,
      guildId: 'test-guild',
      channelId: 'test-channel',
      hostId: 'test-user',
      players: [
        {
          userId: 'player1',
          username: 'Player1',
          score: 0,
          status: PlayerStatus.WAITING,
          joinedAt: new Date()
        }
      ],
      state: 'waiting' as any,
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 300000),
      config: { maxPlayers: 4, minPlayers: 1, timeLimit: 180 },
      data: {}
    };

    game = new MeuNovoJogo(session);
  });

  test('should initialize game data correctly', () => {
    expect(session.data.fase).toBe(1);
    expect(session.data.estado).toBe('preparando');
    expect(session.data.pontuacao).toHaveProperty('player1');
  });

  test('should start game and set players active', async () => {
    await game.start();
    
    expect(session.players[0].status).toBe(PlayerStatus.ACTIVE);
    expect(session.data.estado).toBe('jogando');
  });

  test('should handle player actions correctly', async () => {
    await game.start();
    
    await game.handlePlayerAction('player1', {
      type: 'escolher_opcao',
      opcao: 'opcao_a'
    });
    
    expect(session.data.pontuacao.player1).toBeGreaterThan(0);
  });

  test('should generate correct embed', () => {
    const embed = game.getGameEmbed();
    
    expect(embed.data.title).toContain('Meu Novo Jogo');
    expect(embed.data.description).toContain('Fase:');
  });
});
```

### Executar Testes
```bash
# Todos os testes
npm test

# Testes específicos
npm test -- MeuNovoJogo

# Com coverage
npm run test:coverage

# Watch mode durante desenvolvimento
npm run test:watch
```

## 🔧 Debugging

### Logs de Debug
```typescript
// Usar console.log com namespace
console.log('[MeuJogo]', 'Ação processada:', action);

// Ou usar sistema de log estruturado
import { logger } from '@marquinhos/utils/logger';
logger.info('Game action processed', { 
  gameType: 'meu_jogo', 
  userId, 
  action 
});
```

### Debug do GameManager
```typescript
// Informações do sistema
const debug = gameManager.debugInfo();
console.log('Active sessions:', debug);

// Forçar limpeza para testes
gameManager.forceCleanup();
```

### Ferramentas de Debug
- **VS Code Debugger** - Configurado em `.vscode/launch.json`
- **Node Inspector** - `node --inspect src/index.ts`
- **Discord.js Debug** - `DEBUG=discord* npm start`

## 📊 Performance

### Métricas Importantes
- **Tempo de resposta** - < 500ms por ação
- **Memória** - < 50MB por sessão ativa
- **CPU** - < 10% uso contínuo
- **Concorrência** - Suporte a 100+ sessões simultâneas

### Otimizações
```typescript
// Cache de dados pesados
const cache = new Map();

// Cleanup automático
setInterval(() => {
  // Limpar caches antigos
  cache.clear();
}, 300000); // 5 minutos

// Lazy loading de recursos
async loadGameResources() {
  if (!this.resources) {
    this.resources = await import('./resources');
  }
  return this.resources;
}
```

## 🚀 Deploy

### Build de Produção
```bash
# Compilar TypeScript
npm run build

# Validar build
npm run validate

# Gerar documentação
npm run docs

# Executar testes de produção
npm run test:prod
```

### Variáveis de Ambiente
```env
# .env.production
NODE_ENV=production
MARQUINHOS_TOKEN=your_bot_token
MARQUINHOS_CLIENT_ID=your_client_id
MARQUINHOS_PREFIX=!

# Games específico
GAMES_MAX_SESSIONS=1000
GAMES_CLEANUP_INTERVAL=60000
GAMES_DEFAULT_TIMEOUT=300000
```

## 📝 Documentação

### Atualizando Docs
```bash
# Gerar documentação automática
npm run docs:generate

# Validar OpenAPI
npm run docs:validate

# Servir docs localmente
npm run docs:serve
```

### Padrões de Documentação
- **JSDoc** para funções e classes
- **README** para cada categoria de jogo
- **CHANGELOG** para mudanças importantes
- **OpenAPI** para especificação da API

## 🤝 Contribuindo

### Processo de Contribuição
1. **Fork** do repositório
2. **Branch** para sua feature (`git checkout -b feature/meu-jogo`)
3. **Commit** suas mudanças (`git commit -am 'Add: Meu novo jogo'`)
4. **Push** para o branch (`git push origin feature/meu-jogo`)
5. **Pull Request** com descrição detalhada

### Code Style
```bash
# Linting
npm run lint

# Formatting
npm run format

# Pre-commit hooks
npm run pre-commit
```

### Checklist de PR
- [ ] Testes unitários implementados
- [ ] Documentação atualizada
- [ ] Code review interno
- [ ] Performance testada
- [ ] Compatibilidade verificada

## ❓ FAQ

### Como debugar um jogo específico?
```typescript
// Adicionar logs temporários
console.log('[DEBUG]', session.data);

// Usar breakpoints no VS Code
debugger;

// Monitorar estado do jogo
gameManager.getSessionStats(sessionId);
```

### Como otimizar performance?
- Use `async/await` ao invés de Promises
- Implemente cleanup de dados desnecessários
- Cache recursos pesados
- Minimize operações síncronas

### Como adicionar novos tipos de recompensa?
```typescript
// Estender interface GameReward
interface GameReward {
  xp: number;
  coins?: number;    // Nova recompensa
  items?: string[];  // Nova recompensa
  // ... outras recompensas
}
```

### Como suportar mais jogadores?
```typescript
// Aumentar maxPlayers na configuração
[GameType.MEU_JOGO]: {
  maxPlayers: 20,  // Aumentar limite
  minPlayers: 1,
  // ... outras configs
}
```

---

Este guia cobre os aspectos principais do desenvolvimento. Para dúvidas específicas, consulte a documentação da API ou abra uma issue no repositório.
